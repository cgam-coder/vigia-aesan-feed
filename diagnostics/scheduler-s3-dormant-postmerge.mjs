import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const SCRIPT="vigia-runtime";
const CUTOFF=Date.parse("2026-09-30T08:28:30Z");
const token=process.env.CLOUDFLARE_API_TOKEN;
const api=(path)=>`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}${path}`;
const headers={Authorization:`Bearer ${token}`,Accept:"application/json"};
const out={status:"HOLD",operation:"scheduler-s3-dormant-postmerge",cutoff:new Date(CUTOFF).toISOString(),wakeups:[]};

const safeFetch=async(path, options={})=>{
  const response=await fetch(api(path),{...options,headers:{...headers,...(options.headers??{})},signal:AbortSignal.timeout(45000)});
  const body=await response.json().catch(()=>null);
  return {response,body};
};
const pick=(o,keys)=>Object.fromEntries(Object.entries(o??{}).filter(([k,v])=>keys.has(k)&&
  (v===null||typeof v==="boolean"||typeof v==="number"||typeof v==="string")));

function extractScheduler(event){
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

try{
  if(!token) throw new Error("credential-not-configured");

  const deployments=await safeFetch(`/workers/scripts/${SCRIPT}/deployments`);
  out.deploymentsHttpStatus=deployments.response.status;
  if(!deployments.response.ok) throw new Error("deployments-read-failed");
  const deploymentList=Array.isArray(deployments.body?.result)
    ? deployments.body.result
    : Array.isArray(deployments.body?.result?.deployments)
      ? deployments.body.result.deployments
      : [];
  out.deployments=deploymentList.slice(0,5).map(d=>({
    id:typeof d?.id==="string"?d.id:null,
    createdOn:typeof d?.created_on==="string"?d.created_on:null,
    source:typeof d?.source==="string"?d.source:null,
    versions:Array.isArray(d?.versions)?d.versions.map(v=>({
      versionId:typeof v?.version_id==="string"?v.version_id:null,
      percentage:Number.isFinite(v?.percentage)?v.percentage:null
    })):[],
  }));

  const settings=await safeFetch(`/workers/scripts/${SCRIPT}/settings`);
  out.settingsHttpStatus=settings.response.status;
  if(!settings.response.ok) throw new Error("settings-read-failed");
  const bindings=Array.isArray(settings.body?.result?.bindings)?settings.body.result.bindings:[];
  const modeBinding=bindings.find(b=>b?.name==="NAGAMEALERT_RECENT_SCHEDULER_MODE");
  out.schedulerMode=typeof modeBinding?.text==="string"?modeBinding.text:
    typeof modeBinding?.value==="string"?modeBinding.value:null;

  const schedules=await safeFetch(`/workers/scripts/${SCRIPT}/schedules`);
  out.schedulesHttpStatus=schedules.response.status;
  if(!schedules.response.ok) throw new Error("schedules-read-failed");
  const scheduleList=Array.isArray(schedules.body?.result)?schedules.body.result:[];
  out.crons=scheduleList.map(s=>typeof s?.cron==="string"?s.cron:null).filter(Boolean);

  const query={
    queryId:"vigia-s3-dormant-postmerge",
    dry:true,
    view:"events",
    limit:600,
    timeframe:{from:Math.max(CUTOFF,Date.now()-60*60_000),to:Date.now()+60_000},
    parameters:{
      filterCombination:"and",
      filters:[{key:"$metadata.service",operation:"eq",type:"string",value:SCRIPT}],
      needle:{value:"recent-scheduler",isRegex:false,matchCase:true}
    }
  };
  const telemetry=await safeFetch("/workers/observability/telemetry/query",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(query)
  });
  out.observabilityHttpStatus=telemetry.response.status;
  if(!telemetry.response.ok) throw new Error("observability-read-failed");

  const by=new Map();
  for(const item of (telemetry.body?.result?.events?.events??[]).flatMap(extractScheduler)){
    const t=Number(item.record?.scheduledTime);
    if(!Number.isFinite(t)||t<CUTOFF)continue;
    const g=by.get(String(t))??{scheduledTime:t,s0Sources:[],s0Summary:null,s1:null,s2:[],s3:[],origins:new Set(),eventTypes:new Set()};
    if(item.record.stage==="S0"&&item.record.kind==="source")g.s0Sources.push(item.record);
    if(item.record.stage==="S0"&&item.record.kind==="wake-up")g.s0Summary=item.record;
    if(item.record.stage==="S1-RAPNA-PILOT")g.s1=item.record;
    if(typeof item.record.stage==="string"&&item.record.stage.startsWith("S2-"))g.s2.push(item.record);
    if(typeof item.record.stage==="string"&&item.record.stage.startsWith("S3-"))g.s3.push(item.record);
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
    s3RecordCount:g.s3.length,
    origins:[...g.origins],
    eventTypes:[...g.eventTypes],
  }));

  const validDormant=out.wakeups.filter(w=>
    w.s0SourceCount===5&&w.s0Outcome==="shadow-observed"&&w.s0ReadErrors===0&&
    w.s3RecordCount===0&&w.origins.includes("scheduled")&&w.eventTypes.includes("scheduled")
  );
  const active=out.deployments.find(d=>d.versions.some(v=>v.percentage===100))??out.deployments[0]??null;
  out.activeDeployment=active;
  out.validDormantWakeups=validDormant.length;
  out.status=out.schedulerMode==="rapna-rasff-pilot"&&out.crons.length===1&&out.crons[0]==="*/5 * * * *"&&
    Boolean(active)&&validDormant.length>=1?"PASS":"HOLD";
  if(out.status!=="PASS")out.reason="dormant-postmerge-gate-incomplete";
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}

let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-dormant-postmerge.json",txt);
console.log(txt);
if(out.status!=="PASS")process.exitCode=1;
