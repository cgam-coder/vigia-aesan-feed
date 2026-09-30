import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const SCRIPT="vigia-runtime";
const DEPLOYED_AT=Date.parse("2026-09-30T08:31:45.380Z");
const token=process.env.CLOUDFLARE_API_TOKEN;
const api=(path)=>`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}${path}`;
const headers={Authorization:`Bearer ${token}`,Accept:"application/json"};
const out={status:"HOLD",operation:"s3-dormant-natural-wakeup",deployedAt:new Date(DEPLOYED_AT).toISOString(),wakeups:[]};

const safeFetch=async(path, options={})=>{
  const response=await fetch(api(path),{
    ...options,
    headers:{...headers,...(options.headers??{})},
    signal:AbortSignal.timeout(45000)
  });
  const body=await response.json().catch(()=>null);
  return {response,body};
};
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

try{
  if(!token) throw new Error("credential-not-configured");

  const settings=await safeFetch(`/workers/scripts/${SCRIPT}/settings`);
  out.settingsHttpStatus=settings.response.status;
  if(!settings.response.ok) throw new Error("settings-read-failed");
  const bindings=Array.isArray(settings.body?.result?.bindings)?settings.body.result.bindings:[];
  const mode=bindings.find(b=>b?.name==="NAGAMEALERT_RECENT_SCHEDULER_MODE");
  out.schedulerMode=typeof mode?.text==="string"?mode.text:typeof mode?.value==="string"?mode.value:null;

  const query={
    queryId:"vigia-s3-dormant-natural-wakeup",
    dry:true,
    view:"events",
    limit:1000,
    timeframe:{from:DEPLOYED_AT,to:Date.now()+60_000},
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
  for(const item of (telemetry.body?.result?.events?.events??[]).flatMap(extract)){
    const t=Number(item.record?.scheduledTime);
    if(!Number.isFinite(t)||t<DEPLOYED_AT)continue;
    const key=String(t);
    const g=by.get(key)??{
      scheduledTime:t,s0Sources:[],s0Summary:null,rapna:null,rasff:null,combined:null,s3:[],
      origins:new Set(),eventTypes:new Set()
    };
    if(item.record.stage==="S0"&&item.record.kind==="source")g.s0Sources.push(item.record);
    if(item.record.stage==="S0"&&item.record.kind==="wake-up")g.s0Summary=item.record;
    if(item.record.stage==="S1-RAPNA-PILOT")g.rapna=item.record;
    if(item.record.stage==="S2-RASFF-PILOT")g.rasff=item.record;
    if(item.record.stage==="S2-RAPNA-RASFF-COMBINED")g.combined=item.record;
    if(typeof item.record.stage==="string"&&item.record.stage.startsWith("S3-"))g.s3.push(item.record);
    if(typeof item.meta.origin==="string")g.origins.add(item.meta.origin);
    if(typeof item.workers.eventType==="string")g.eventTypes.add(item.workers.eventType);
    by.set(key,g);
  }

  out.wakeups=[...by.values()].sort((a,b)=>a.scheduledTime-b.scheduledTime).map(g=>({
    scheduledAt:new Date(g.scheduledTime).toISOString(),
    s0SourceCount:new Set(g.s0Sources.map(s=>s.source)).size,
    s0Outcome:g.s0Summary?.outcome??null,
    s0ReadErrors:g.s0Summary?.readErrors??null,
    rapnaOutcome:g.rapna?.outcome??null,
    rapnaMutationAttempts:g.rapna?.mutationAttempts??null,
    rasffOutcome:g.rasff?.outcome??null,
    rasffMutationAttempts:g.rasff?.mutationAttempts??null,
    combinedOutcome:g.combined?.outcome??null,
    combinedMutationAttempts:g.combined?.mutationAttempts??null,
    s3RecordCount:g.s3.length,
    origins:[...g.origins],
    eventTypes:[...g.eventTypes]
  }));

  const valid=out.wakeups.filter(w=>
    w.s0SourceCount===5&&w.s0Outcome==="shadow-observed"&&w.s0ReadErrors===0&&
    typeof w.combinedOutcome==="string"&&
    ["idle","executed-rapna","executed-rasff","attempted-rapna","hold"].includes(w.combinedOutcome)&&
    Number.isInteger(w.combinedMutationAttempts)&&w.combinedMutationAttempts>=0&&w.combinedMutationAttempts<=1&&
    w.s3RecordCount===0&&w.origins.includes("scheduled")&&w.eventTypes.includes("scheduled")
  );
  out.validDormantWakeups=valid.length;
  out.s3RecordsTotal=out.wakeups.reduce((sum,w)=>sum+w.s3RecordCount,0);
  out.status=out.schedulerMode==="rapna-rasff-pilot"&&valid.length>=1&&out.s3RecordsTotal===0?"PASS":"HOLD";
  if(out.status!=="PASS")out.reason="no-valid-natural-dormant-wakeup-yet";
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}

let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-dormant-postmerge.json",txt);
console.log(txt);
if(out.status!=="PASS")process.exitCode=1;
