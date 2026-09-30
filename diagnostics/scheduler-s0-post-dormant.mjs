import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const CUTOFF=Date.parse("2026-09-30T06:01:06Z");
const token=process.env.CLOUDFLARE_API_TOKEN;
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/observability/telemetry/query`;
const query={
  queryId:"vigia-s0-post-dormant-deploy",
  dry:true,
  view:"events",
  limit:300,
  timeframe:{from:Date.now()-20*60_000,to:Date.now()+60_000},
  parameters:{filterCombination:"and",filters:[
    {key:"$metadata.service",operation:"eq",type:"string",value:"vigia-runtime"}
  ],needle:{value:"recent-scheduler",isRegex:false,matchCase:true}}
};

const fields=new Set(("component schemaVersion stage triggerProvider scheduledTime cron zeroWrite requestExecuted mutationAttempts kind source blockedReason error observedAt outcome sourcesObserved readErrors").split(" "));
const pick=(o,keys)=>Object.fromEntries(Object.entries(o??{}).filter(([k,v])=>keys.has(k)&&
  (v===null||typeof v==="boolean"||typeof v==="number"||typeof v==="string")));

function extract(event){
  const found=[];
  function visit(value,depth=0){
    if(depth>10)return;
    if(typeof value==="string"&&value.startsWith("{")){
      try{visit(JSON.parse(value),depth+1);}catch{}
    }else if(value&&typeof value==="object"){
      if(value.component==="recent-scheduler"&&value.stage==="S0"&&["source","wake-up"].includes(value.kind)){
        found.push(pick(value,fields));
      }else for(const child of Object.values(value))visit(child,depth+1);
    }
  }
  visit(event);
  const metadata=pick(event.$metadata,new Set(["service","origin","trigger","timestamp","type"]));
  const workers=pick(event.$workers??event.source?.$workers,new Set(["scriptName","eventType","outcome"]));
  return found.map(record=>({record,metadata,workers,timestamp:event.timestamp??null}));
}

const out={status:"HOLD",operation:"s0-post-dormant-natural-cycle",cutoff:new Date(CUTOFF).toISOString(),wakeups:[]};
try{
  if(!token)throw new Error("missing-token");
  const response=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify(query),signal:AbortSignal.timeout(45000)});
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
    const group=by.get(key)??{scheduledTime:t,sources:[],summary:null,origins:new Set(),eventTypes:new Set()};
    if(item.record.kind==="source")group.sources.push(item.record);
    if(item.record.kind==="wake-up")group.summary=item.record;
    if(typeof item.metadata.origin==="string")group.origins.add(item.metadata.origin);
    if(typeof item.workers.eventType==="string")group.eventTypes.add(item.workers.eventType);
    by.set(key,group);
  }
  out.wakeups=[...by.values()].sort((a,b)=>a.scheduledTime-b.scheduledTime).map(g=>({
    scheduledTime:g.scheduledTime,
    scheduledAt:new Date(g.scheduledTime).toISOString(),
    sourceCount:new Set(g.sources.map(s=>s.source)).size,
    sources:[...new Set(g.sources.map(s=>s.source))].sort(),
    zeroWrite:g.summary?.zeroWrite??null,
    requestExecuted:g.summary?.requestExecuted??null,
    mutationAttempts:g.summary?.mutationAttempts??null,
    outcome:g.summary?.outcome??null,
    sourcesObserved:g.summary?.sourcesObserved??null,
    readErrors:g.summary?.readErrors??null,
    origins:[...g.origins],
    eventTypes:[...g.eventTypes]
  }));
  const valid=out.wakeups.filter(w=>w.sourceCount===5&&w.zeroWrite===true&&w.requestExecuted===false&&
    w.mutationAttempts===0&&w.outcome==="shadow-observed"&&w.sourcesObserved===5&&w.readErrors===0&&
    w.origins.includes("scheduled")&&w.eventTypes.includes("scheduled"));
  out.validWakeups=valid.length;
  out.status=valid.length>=1?"PASS":"HOLD";
  if(out.status!=="PASS")out.reason="no-valid-post-deploy-natural-wakeup-yet";
}catch(e){out.reason=e instanceof Error?e.message:"bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s0-post-dormant.json",txt);
console.log(txt);
if(out.status!=="PASS")process.exitCode=1;
