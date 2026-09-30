const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const SCRIPT="vigia-runtime";
const BASE="https://vigia-runtime.c-gamiz93.workers.dev";
const DEPLOYED_AT=Date.parse("2026-09-30T09:43:18.283Z");
const cfToken=process.env.CLOUDFLARE_API_TOKEN;
const syncToken=process.env.VIGIA_SYNC_TOKEN;
if(!cfToken||!syncToken) throw new Error("credential-not-configured");

const previewResponse=await fetch(BASE+"/api/safety-gate/sync?mode=delta-preview",{
  method:"POST",
  headers:{Authorization:`Bearer ${syncToken}`,Accept:"application/json"},
  signal:AbortSignal.timeout(180000),
});
const previewBody=await previewResponse.json().catch(()=>null);
const p=previewBody?.preview??null;
const preview={
  httpStatus:previewResponse.status,
  zeroWrite:p?.zeroWrite??null,
  coverage:p?.discovery?.coverage??null,
  totalDeclared:p?.discovery?.totalDeclared??null,
  pagesScanned:p?.pagesScanned??null,
  recordsObserved:p?.recordsObserved??null,
  recordsDeduplicated:p?.recordsDeduplicated??null,
  storedMatched:p?.storedMatched??null,
  baselineDetailRequests:p?.baselineDetailRequests??null,
  candidateDetailRequests:p?.candidateDetailRequests??null,
  savedDetailRequests:p?.savedDetailRequests??null,
  reductionPercent:p?.reductionPercent??null,
  reasons:p?.reasons??null,
};
const previewPass=preview.httpStatus===200&&preview.zeroWrite===true&&preview.coverage==="complete"&&
  Number.isInteger(preview.totalDeclared)&&preview.totalDeclared>0&&
  preview.recordsObserved===preview.totalDeclared&&preview.recordsDeduplicated===preview.totalDeclared;

const query={
  queryId:"f2a-postdeploy-s2",
  dry:true,
  view:"events",
  limit:800,
  timeframe:{from:DEPLOYED_AT,to:Date.now()+60000},
  parameters:{
    filterCombination:"and",
    filters:[{key:"$metadata.service",operation:"eq",type:"string",value:SCRIPT}],
    needle:{value:"recent-scheduler",isRegex:false,matchCase:true}
  }
};
const telemetryResponse=await fetch(`${API}/accounts/${ACCOUNT}/workers/observability/telemetry/query`,{
  method:"POST",
  headers:{Authorization:`Bearer ${cfToken}`,"Content-Type":"application/json",Accept:"application/json"},
  body:JSON.stringify(query),
  signal:AbortSignal.timeout(45000),
});
const telemetryBody=await telemetryResponse.json().catch(()=>null);
const pick=(o,keys)=>Object.fromEntries(Object.entries(o??{}).filter(([k,v])=>keys.has(k)&&
  (v===null||typeof v==="boolean"||typeof v==="number"||typeof v==="string")));
function extract(event){
  const found=[];
  function visit(v,d=0){
    if(d>10)return;
    if(typeof v==="string"&&v.startsWith("{")){try{visit(JSON.parse(v),d+1);}catch{}}
    else if(v&&typeof v==="object"){
      if(v.component==="recent-scheduler")found.push(v);
      else for(const child of Object.values(v))visit(child,d+1);
    }
  }
  visit(event);
  const meta=pick(event.$metadata,new Set(["origin"]));
  const workers=pick(event.$workers??event.source?.$workers,new Set(["eventType"]));
  return found.map(record=>({record,meta,workers}));
}
const by=new Map();
for(const item of (telemetryBody?.result?.events?.events??[]).flatMap(extract)){
  const t=Number(item.record?.scheduledTime);
  if(!Number.isFinite(t)||t<DEPLOYED_AT)continue;
  const key=String(t);
  const g=by.get(key)??{scheduledTime:t,s0Sources:[],s0:null,combined:null,origins:new Set(),eventTypes:new Set()};
  if(item.record.stage==="S0"&&item.record.kind==="source")g.s0Sources.push(item.record);
  if(item.record.stage==="S0"&&item.record.kind==="wake-up")g.s0=item.record;
  if(item.record.stage==="S2-RAPNA-RASFF-COMBINED")g.combined=item.record;
  if(typeof item.meta.origin==="string")g.origins.add(item.meta.origin);
  if(typeof item.workers.eventType==="string")g.eventTypes.add(item.workers.eventType);
  by.set(key,g);
}
const wakeups=[...by.values()].sort((a,b)=>a.scheduledTime-b.scheduledTime).map(g=>({
  scheduledAt:new Date(g.scheduledTime).toISOString(),
  s0SourceCount:new Set(g.s0Sources.map(s=>s.source)).size,
  s0Outcome:g.s0?.outcome??null,
  s0ReadErrors:g.s0?.readErrors??null,
  combinedMode:g.combined?.mode??null,
  combinedOutcome:g.combined?.outcome??null,
  mutationAttempts:g.combined?.mutationAttempts??null,
  origins:[...g.origins],
  eventTypes:[...g.eventTypes],
}));
const validWakeups=wakeups.filter(w=>w.s0SourceCount===5&&w.s0Outcome==="shadow-observed"&&w.s0ReadErrors===0&&
  w.combinedMode==="rapna-rasff-pilot"&&Number.isInteger(w.mutationAttempts)&&w.mutationAttempts>=0&&w.mutationAttempts<=1&&
  w.origins.includes("scheduled")&&w.eventTypes.includes("scheduled"));
const telemetryPass=telemetryResponse.ok&&validWakeups.length>=1;
const out={
  status:previewPass&&telemetryPass?"PASS":"HOLD",
  deployedAt:new Date(DEPLOYED_AT).toISOString(),
  preview,
  telemetryHttpStatus:telemetryResponse.status,
  wakeups,
  validWakeups:validWakeups.length,
};
console.log("F2A_POSTDEPLOY_EVIDENCE "+JSON.stringify(out));
if(out.status!=="PASS") process.exit(1);
