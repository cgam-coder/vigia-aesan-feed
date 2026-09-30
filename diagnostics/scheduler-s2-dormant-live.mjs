import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const CUTOFF=Date.parse("2026-09-30T07:44:44.113Z");
const token=process.env.CLOUDFLARE_API_TOKEN;
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/observability/telemetry/query`;
const query={
  queryId:"vigia-s2-dormant-postdeploy",
  dry:true,
  view:"events",
  limit:400,
  timeframe:{from:Date.now()-30*60_000,to:Date.now()+60_000},
  parameters:{
    filterCombination:"and",
    filters:[{key:"$metadata.service",operation:"eq",type:"string",value:"vigia-runtime"}],
    needle:{value:"recent-scheduler",isRegex:false,matchCase:true}
  }
};
const common=new Set("component schemaVersion stage triggerProvider scheduledTime cron zeroWrite requestExecuted mutationAttempts kind source blockedReason error observedAt outcome sourcesObserved readErrors retirementAuthorized".split(" "));
const pick=(o,keys)=>Object.fromEntries(Object.entries(o??{}).filter(([k,v])=>keys.has(k)&&
  (v===null||typeof v==="boolean"||typeof v==="number"||typeof v==="string")));
function extract(event){
  const found=[];
  function visit(v,d=0){
    if(d>10)return;
    if(typeof v==="string"&&v.startsWith("{")){try{visit(JSON.parse(v),d+1);}catch{}}
    else if(v&&typeof v==="object"){
      if(v.component==="recent-scheduler")found.push(pick(v,common));
      else for(const child of Object.values(v))visit(child,d+1);
    }
  }
  visit(event);
  const meta=pick(event.$metadata,new Set(["origin"]));
  const workers=pick(event.$workers??event.source?.$workers,new Set(["eventType"]));
  return found.map(record=>({record,meta,workers}));
}
const out={status:"HOLD",operation:"s2-dormant-postdeploy",cutoff:new Date(CUTOFF).toISOString(),wakeups:[]};
try{
  const r=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify(query),signal:AbortSignal.timeout(45000)});
  out.httpStatus=r.status;
  if(!r.ok)throw new Error("observability-read-failed");
  const body=await r.json();
  const events=body?.result?.events?.events??[];
  const by=new Map();
  for(const item of events.flatMap(extract)){
    const t=Number(item.record.scheduledTime);
    if(!Number.isFinite(t)||t<CUTOFF)continue;
    const g=by.get(String(t))??{scheduledTime:t,s0Sources:[],s0Summary:null,s1:null,s2:[],origins:new Set(),eventTypes:new Set()};
    if(item.record.stage==="S0"&&item.record.kind==="source")g.s0Sources.push(item.record);
    if(item.record.stage==="S0"&&item.record.kind==="wake-up")g.s0Summary=item.record;
    if(item.record.stage==="S1-RAPNA-PILOT")g.s1=item.record;
    if(item.record.stage==="S2-RASFF-PILOT"||item.record.stage==="S2-RAPNA-RASFF-COMBINED")g.s2.push(item.record);
    if(typeof item.meta.origin==="string")g.origins.add(item.meta.origin);
    if(typeof item.workers.eventType==="string")g.eventTypes.add(item.workers.eventType);
    by.set(String(t),g);
  }
  out.wakeups=[...by.values()].sort((a,b)=>a.scheduledTime-b.scheduledTime).map(g=>({
    scheduledAt:new Date(g.scheduledTime).toISOString(),
    s0SourceCount:new Set(g.s0Sources.map(s=>s.source)).size,
    s0Outcome:g.s0Summary?.outcome??null,
    s0ReadErrors:g.s0Summary?.readErrors??null,
    s1Outcome:g.s1?.outcome??null,
    s1MutationAttempts:g.s1?.mutationAttempts??null,
    s2RecordCount:g.s2.length,
    origins:[...g.origins],
    eventTypes:[...g.eventTypes]
  }));
  const valid=out.wakeups.filter(w=>w.s0SourceCount===5&&w.s0Outcome==="shadow-observed"&&w.s0ReadErrors===0&&
    ["not-executed","executed"].includes(w.s1Outcome)&&Number.isInteger(w.s1MutationAttempts)&&
    w.s2RecordCount===0&&w.origins.includes("scheduled")&&w.eventTypes.includes("scheduled"));
  out.validWakeups=valid.length;
  out.status=valid.length>=1?"PASS":"HOLD";
  if(out.status!=="PASS")out.reason="no-valid-post-dormant-wakeup-yet";
}catch(e){out.reason=e instanceof Error?e.message:"bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s2-dormant-postdeploy.json",txt);
console.log(txt);
if(out.status!=="PASS")process.exitCode=1;
