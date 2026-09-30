import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const CUTOFF=Date.parse("2026-09-30T08:31:45.380Z");
const token=process.env.CLOUDFLARE_API_TOKEN;
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/observability/telemetry/query`;
const query={
  queryId:"vigia-s3-dormant-postdeploy",
  dry:true,
  view:"events",
  limit:700,
  timeframe:{from:CUTOFF-60_000,to:Date.now()+60_000},
  parameters:{
    filterCombination:"and",
    filters:[{key:"$metadata.service",operation:"eq",type:"string",value:"vigia-runtime"}],
    needle:{value:"recent-scheduler",isRegex:false,matchCase:true}
  }
};
const common=new Set("component schemaVersion stage triggerProvider scheduledTime cron zeroWrite requestExecuted mutationAttempts kind source blockedReason error observedAt outcome sourcesObserved readErrors retirementAuthorized leaseActiveAfter deferredDetailCount pageErrorDelta mode".split(" "));
const pick=(o,keys)=>Object.fromEntries(Object.entries(o??{}).filter(([k,v])=>keys.has(k)&&
  (v===null||typeof v==="boolean"||typeof v==="number"||typeof v==="string")));
function sanitize(v){return pick(v,common);}
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
const out={status:"HOLD",operation:"s3-dormant-postdeploy-evidence",cutoff:new Date(CUTOFF).toISOString(),wakeups:[]};
try{
  if(!token)throw new Error("credential-not-configured");
  const r=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify(query),signal:AbortSignal.timeout(45000)});
  out.httpStatus=r.status;
  if(!r.ok)throw new Error("observability-read-failed");
  const body=await r.json();
  const by=new Map();
  for(const item of (body?.result?.events?.events??[]).flatMap(extract)){
    const t=Number(item.record.scheduledTime);
    if(!Number.isFinite(t)||t<CUTOFF)continue;
    const g=by.get(String(t))??{
      scheduledTime:t,s0Sources:[],s0Summary:null,rapna:null,rasff:null,combined:null,
      s3Records:[],origins:new Set(),eventTypes:new Set()
    };
    if(item.record.stage==="S0"&&item.record.kind==="source")g.s0Sources.push(item.record);
    if(item.record.stage==="S0"&&item.record.kind==="wake-up")g.s0Summary=item.record;
    if(item.record.stage==="S1-RAPNA-PILOT")g.rapna=item.record;
    if(item.record.stage==="S2-RASFF-PILOT")g.rasff=item.record;
    if(item.record.stage==="S2-RAPNA-RASFF-COMBINED")g.combined=item.record;
    if(String(item.record.stage??"").startsWith("S3-"))g.s3Records.push(item.record);
    if(typeof item.meta.origin==="string")g.origins.add(item.meta.origin);
    if(typeof item.workers.eventType==="string")g.eventTypes.add(item.workers.eventType);
    by.set(String(t),g);
  }
  out.wakeups=[...by.values()].sort((a,b)=>a.scheduledTime-b.scheduledTime).map(g=>({
    scheduledAt:new Date(g.scheduledTime).toISOString(),
    s0:{
      sourceCount:new Set(g.s0Sources.map(s=>s.source)).size,
      outcome:g.s0Summary?.outcome??null,
      readErrors:g.s0Summary?.readErrors??null,
      mutationAttempts:g.s0Summary?.mutationAttempts??null,
    },
    rapna:g.rapna,
    rasff:g.rasff,
    combined:g.combined,
    s3RecordCount:g.s3Records.length,
    origins:[...g.origins],
    eventTypes:[...g.eventTypes],
  }));
  const valid=out.wakeups.filter(w=>{
    const attempts=Number(w.combined?.mutationAttempts??0);
    return w.s0.sourceCount===5&&w.s0.outcome==="shadow-observed"&&w.s0.readErrors===0&&
      w.s0.mutationAttempts===0&&
      w.combined?.mode==="rapna-rasff-pilot"&&
      ["idle","executed-rapna","attempted-rapna","executed-rasff","attempted-rasff"].includes(w.combined?.outcome)&&
      Number.isFinite(attempts)&&attempts>=0&&attempts<=1&&
      w.s3RecordCount===0&&w.origins.includes("scheduled")&&w.eventTypes.includes("scheduled");
  });
  out.validWakeups=valid.length;
  out.status=valid.length>=1?"PASS_DORMANT_POSTDEPLOY":"HOLD";
  if(out.status==="HOLD")out.reason="no-valid-postdeploy-s2-wakeup-yet";
}catch(e){out.reason=e instanceof Error?e.message:"bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-dormant-postdeploy.json",txt);
console.log(txt);
if(out.status==="HOLD")process.exitCode=1;
