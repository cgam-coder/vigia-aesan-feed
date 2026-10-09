import {fetchRasffReconcileBatch} from '../lib/rasff-reconcile';
const root='https://api.cloudflare.com/client/v4/accounts/9c1807c68493f14259248b5f5782cc6f';
if(Date.now()>Date.parse('2026-10-09T08:20:00Z')||Number(process.env.RUN_ATTEMPT)!==1)throw Error('Bounded GET benchmark expired');
const sql="SELECT cursor,cursor_key FROM source_sync_state WHERE source='RASFF' AND mode='reconcile'";
const response=await fetch(root+'/d1/database/55596003-1b90-4f66-aad8-decb21205f13/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CF_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(25000)}),body=await response.json();
if(!response.ok||!body.success||body.result.some((r:any)=>r.meta.rows_written||r.meta.changes))throw Error('SELECT benchmark cursor unconfirmed');
const state=body.result[0].results[0],at=new Date().toISOString(),results=[];
for(const concurrency of [3,6]){
 let requests=0,inflight=0,peak=0;const durations:number[]=[];
 const fetchImpl:typeof fetch=async(input,init)=>{if(init?.method&&init.method!=='GET')throw Error('Official GET-only benchmark');requests++;inflight++;peak=Math.max(peak,inflight);const started=performance.now();try{return await fetch(input,init);}finally{inflight--;durations.push(performance.now()-started);}};
 const started=performance.now(),r=await fetchRasffReconcileBatch(state.cursor,state.cursor_key,{fetch:fetchImpl,detailConcurrency:concurrency,detailMaxAttempts:1},at,40);
 const wallMs=performance.now()-started;durations.sort((a,b)=>a-b);
 const record={concurrency,requests,peak,wallMs,requestP50Ms:durations[Math.floor(durations.length*.5)],requestP95Ms:durations[Math.floor(durations.length*.95)],processed:r.processedCount,retained:r.retainedCount,detailFailures:r.detailFailures,nextCursor:r.nextCursor,nextCursorKey:r.nextCursorKey,identities:r.alerts.map(x=>({reference:x.reference,hash:x.contentHash})).sort((a,b)=>a.reference.localeCompare(b.reference))};results.push(record);
 console.log('R10_RASFF_GET_BENCHMARK '+JSON.stringify({at:new Date().toISOString(),cursor:state.cursor,anchor:state.cursor_key,...record,zeroWrite:true}));
}
if(results.some(x=>x.detailFailures)||results[0].nextCursor!==results[1].nextCursor||JSON.stringify(results[0].identities)!==JSON.stringify(results[1].identities))throw Error('Equivalent official coverage unproved');
console.log('R10_RASFF_GET_BENCHMARK_COMPLETE '+JSON.stringify({at:new Date().toISOString(),speedup:results[0].wallMs/results[1].wallMs,equivalent:true,zeroWrite:true}));
