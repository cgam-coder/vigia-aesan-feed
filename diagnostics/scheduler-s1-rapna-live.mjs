import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const CUTOFF=Date.parse("2026-09-30T06:14:57Z");
const token=process.env.CLOUDFLARE_API_TOKEN;
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/observability/telemetry/query`;
const query={
  queryId:"vigia-s1-rapna-live",
  dry:true,
  view:"events",
  limit:500,
  timeframe:{from:Date.now()-30*60_000,to:Date.now()+60_000},
  parameters:{
    filterCombination:"and",
    filters:[{key:"$metadata.service",operation:"eq",type:"string",value:"vigia-runtime"}],
    needle:{value:"recent-scheduler",isRegex:false,matchCase:true}
  }
};

const common=new Set("component schemaVersion stage triggerProvider scheduledTime cron zeroWrite requestExecuted mutationAttempts kind source blockedReason error observedAt outcome sourcesObserved readErrors retirementAuthorized leaseActiveAfter".split(" "));
const stateFields=new Set("status cursor recordsObserved recordsPersisted newCount updatedCount pageErrors detailFailures lastSuccessAt completedAt lastError leaseOwnerId leaseMode leaseExpiresAt".split(" "));
const pick=(o,keys)=>Object.fromEntries(Object.entries(o??{}).filter(([k,v])=>keys.has(k)&&
  (v===null||typeof v==="boolean"||typeof v==="number"||typeof v==="string")));

function sanitizeRecord(value){
  const out=pick(value,common);
  if(value?.before&&typeof value.before==="object") out.before=pick(value.before,stateFields);
  if(value?.after&&typeof value.after==="object") out.after=pick(value.after,stateFields);
  return out;
}
function extract(event){
  const found=[];
  function visit(value,depth=0){
    if(depth>10)return;
    if(typeof value==="string"&&value.startsWith("{")){
      try{visit(JSON.parse(value),depth+1);}catch{}
    }else if(value&&typeof value==="object"){
      if(value.component==="recent-scheduler"&&(value.stage==="S0"||value.stage==="S1-RAPNA-PILOT")){
        found.push(sanitizeRecord(value));
      }else for(const child of Object.values(value))visit(child,depth+1);
    }
  }
  visit(event);
  const metadata=pick(event.$metadata,new Set(["service","origin","trigger","timestamp","type"]));
  const workers=pick(event.$workers??event.source?.$workers,new Set(["scriptName","eventType","outcome"]));
  return found.map(record=>({record,metadata,workers,timestamp:event.timestamp??null}));
}

const out={status:"HOLD",operation:"s1-rapna-live-evidence",cutoff:new Date(CUTOFF).toISOString(),wakeups:[]};
try{
  if(!token)throw new Error("missing-token");
  const response=await fetch(endpoint,{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify(query),
    signal:AbortSignal.timeout(45000)
  });
  out.httpStatus=response.status;
  if(!response.ok)throw new Error("observability-read-failed");
  const body=await response.json();
  const events=body?.result?.events?.events??[];
  const extracted=events.flatMap(extract);
  const by=new Map();
  for(const item of extracted){
    const t=Number(item.record.scheduledTime);
    if(!Number.isFinite(t)||t<CUTOFF)continue;
    const key=String(t);
    const g=by.get(key)??{scheduledTime:t,s0Sources:[],s0Summary:null,s1:null,origins:new Set(),eventTypes:new Set()};
    if(item.record.stage==="S0"&&item.record.kind==="source")g.s0Sources.push(item.record);
    if(item.record.stage==="S0"&&item.record.kind==="wake-up")g.s0Summary=item.record;
    if(item.record.stage==="S1-RAPNA-PILOT")g.s1=item.record;
    if(typeof item.metadata.origin==="string")g.origins.add(item.metadata.origin);
    if(typeof item.workers.eventType==="string")g.eventTypes.add(item.workers.eventType);
    by.set(key,g);
  }
  out.wakeups=[...by.values()].sort((a,b)=>a.scheduledTime-b.scheduledTime).map(g=>({
    scheduledTime:g.scheduledTime,
    scheduledAt:new Date(g.scheduledTime).toISOString(),
    s0:{
      sourceCount:new Set(g.s0Sources.map(s=>s.source)).size,
      sources:[...new Set(g.s0Sources.map(s=>s.source))].sort(),
      zeroWrite:g.s0Summary?.zeroWrite??null,
      requestExecuted:g.s0Summary?.requestExecuted??null,
      mutationAttempts:g.s0Summary?.mutationAttempts??null,
      outcome:g.s0Summary?.outcome??null,
      sourcesObserved:g.s0Summary?.sourcesObserved??null,
      readErrors:g.s0Summary?.readErrors??null
    },
    s1:g.s1??null,
    origins:[...g.origins],
    eventTypes:[...g.eventTypes]
  }));
  const idle=out.wakeups.filter(w=>w.s0.sourceCount===5&&w.s0.zeroWrite===true&&w.s0.requestExecuted===false&&
    w.s0.mutationAttempts===0&&w.s0.outcome==="shadow-observed"&&w.s0.sourcesObserved===5&&w.s0.readErrors===0&&
    w.s1?.outcome==="not-executed"&&w.s1?.blockedReason==="recent-not-required"&&w.s1?.mutationAttempts===0&&
    w.s1?.requestExecuted===false&&w.origins.includes("scheduled")&&w.eventTypes.includes("scheduled"));
  const executed=out.wakeups.filter(w=>w.s0.sourceCount===5&&w.s0.readErrors===0&&w.s1?.outcome==="executed"&&
    w.s1?.mutationAttempts===1&&w.s1?.requestExecuted===true&&w.s1?.leaseActiveAfter===false&&
    w.origins.includes("scheduled")&&w.eventTypes.includes("scheduled"));
  out.idleWakeups=idle.length;
  out.executedWakeups=executed.length;
  out.status=idle.length>=1?"PASS_IDLE":"HOLD";
  if(out.status==="HOLD")out.reason="no-valid-idle-wakeup-yet";
}catch(e){out.reason=e instanceof Error?e.message:"bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s1-rapna-live.json",txt);
console.log(txt);
if(out.status==="HOLD")process.exitCode=1;
