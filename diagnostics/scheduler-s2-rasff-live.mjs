import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const CUTOFF=Date.parse("2026-10-03T13:39:24.717Z");
const token=process.env.CLOUDFLARE_API_TOKEN;
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/observability/telemetry/query`;
const query={
  queryId:"vigia-s3-oecd-live",
  dry:true,
  view:"events",
  limit:800,
  timeframe:{from:Date.now()-30*60_000,to:Date.now()+60_000},
  parameters:{
    filterCombination:"and",
    filters:[{key:"$metadata.service",operation:"eq",type:"string",value:"vigia-runtime"}],
    needle:{value:"recent-scheduler",isRegex:false,matchCase:true}
  }
};
const common=new Set("component schemaVersion stage triggerProvider scheduledTime cron zeroWrite requestExecuted mutationAttempts kind source blockedReason error observedAt outcome sourcesObserved readErrors retirementAuthorized leaseActiveAfter deferredDetailCount pageErrorDelta mode".split(" "));
const stateFields=new Set("status cursor recordsObserved recordsPersisted newCount updatedCount pageErrors detailFailures lastSuccessAt completedAt lastError leaseOwnerId leaseMode leaseExpiresAt".split(" "));
const pick=(o,keys)=>Object.fromEntries(Object.entries(o??{}).filter(([k,v])=>keys.has(k)&&(v===null||typeof v==="boolean"||typeof v==="number"||typeof v==="string")));
function sanitize(v){
  const out=pick(v,common);
  if(v?.before&&typeof v.before==="object")out.before=pick(v.before,stateFields);
  if(v?.after&&typeof v.after==="object")out.after=pick(v.after,stateFields);
  return out;
}
function extract(event){
  const found=[];
  function visit(v,d=0){
    if(d>10)return;
    if(typeof v==="string"&&v.startsWith("{")){try{visit(JSON.parse(v),d+1);}catch{}}
    else if(v&&typeof v==="object"){
      if(v.component==="recent-scheduler")found.push(sanitize(v));
      else for(const child of Object.values(v))visit(child,d+1);
    }
  }
  visit(event);
  const meta=pick(event.$metadata,new Set(["origin"]));
  const workers=pick(event.$workers??event.source?.$workers,new Set(["eventType"]));
  return found.map(record=>({record,meta,workers}));
}
const out={status:"HOLD",operation:"s3-oecd-live-evidence",cutoff:new Date(CUTOFF).toISOString(),wakeups:[]};
try{
  const r=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(query),signal:AbortSignal.timeout(45000)});
  out.httpStatus=r.status;
  if(!r.ok)throw new Error("observability-read-failed");
  const body=await r.json();
  const by=new Map();
  for(const item of (body?.result?.events?.events??[]).flatMap(extract)){
    const t=Number(item.record.scheduledTime);
    if(!Number.isFinite(t)||t<CUTOFF)continue;
    const g=by.get(String(t))??{scheduledTime:t,s0Sources:[],s0Summary:null,rapna:null,rasff:null,oecd:null,combined:null,origins:new Set(),eventTypes:new Set()};
    if(item.record.stage==="S0"&&item.record.kind==="source")g.s0Sources.push(item.record);
    if(item.record.stage==="S0"&&item.record.kind==="wake-up")g.s0Summary=item.record;
    if(item.record.stage==="S1-RAPNA-PILOT")g.rapna=item.record;
    if(item.record.stage==="S2-RASFF-PILOT")g.rasff=item.record;
    if(item.record.stage==="S3-OECD-PILOT")g.oecd=item.record;
    if(item.record.stage==="S3-RAPNA-RASFF-OECD-COMBINED")g.combined=item.record;
    if(typeof item.meta.origin==="string")g.origins.add(item.meta.origin);
    if(typeof item.workers.eventType==="string")g.eventTypes.add(item.workers.eventType);
    by.set(String(t),g);
  }
  out.wakeups=[...by.values()].sort((a,b)=>a.scheduledTime-b.scheduledTime).map(g=>({
    scheduledAt:new Date(g.scheduledTime).toISOString(),
    s0:{sourceCount:new Set(g.s0Sources.map(s=>s.source)).size,outcome:g.s0Summary?.outcome??null,readErrors:g.s0Summary?.readErrors??null},
    rapna:g.rapna,rasff:g.rasff,oecd:g.oecd,combined:g.combined,
    origins:[...g.origins],eventTypes:[...g.eventTypes]
  }));
  const natural=out.wakeups.filter(w=>w.s0.sourceCount===5&&w.s0.outcome==="shadow-observed"&&w.s0.readErrors===0&&w.origins.includes("scheduled")&&w.eventTypes.includes("scheduled"));
  const safe=natural.filter(w=>w.combined&&w.combined.outcome!=="hold"&&Number.isInteger(w.combined.mutationAttempts)&&w.combined.mutationAttempts<=1);
  const idle=safe.filter(w=>w.combined.outcome==="idle"&&w.combined.mutationAttempts===0);
  const coexist=safe.filter(w=>w.oecd?.outcome==="not-executed"&&["active-lease","recent-not-required","backfill-snapshot-active","control-evidence-changed"].includes(w.oecd?.blockedReason));
  const executed=safe.filter(w=>w.oecd?.outcome==="executed"&&w.oecd?.requestExecuted===true&&w.oecd?.mutationAttempts===1&&w.oecd?.leaseActiveAfter===false&&
    w.oecd?.after?.status==="completed"&&w.oecd?.after?.lastError===null&&w.oecd?.after?.pageErrors===0&&w.oecd?.after?.detailFailures===0&&
    w.oecd?.after?.recordsPersisted===w.oecd?.after?.newCount+w.oecd?.after?.updatedCount&&w.combined?.outcome==="executed-oecd"&&w.combined?.mutationAttempts===1);
  out.naturalWakeups=natural.length;
  out.safeWakeups=safe.length;
  out.idleWakeups=idle.length;
  out.coexistenceWakeups=coexist.length;
  out.executedOecdWakeups=executed.length;
  out.status=executed.length>=1&&safe.length>=1?"PASS_EXECUTED":safe.length>=1?"PASS_SAFE_ONLY":"HOLD";
  if(out.status==="HOLD")out.reason="no-valid-s3-wakeup-yet";
}catch(e){out.reason=e instanceof Error?e.message:"bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-oecd-live.json",txt);
console.log(txt);
if(out.status==="HOLD")process.exitCode=1;
