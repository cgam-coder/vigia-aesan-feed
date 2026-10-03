import { writeFile } from "node:fs/promises";

const ACCOUNT_ID="9c1807c68493f14259248b5f5782cc6f";
const SCRIPT="vigia-runtime";
const API="https://api.cloudflare.com/client/v4";

async function cf(path,token){
  const response=await fetch(API+path,{
    method:"GET",redirect:"error",
    headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
    signal:AbortSignal.timeout(30000),
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.success===false||body?.errors?.length)
    return {ok:false,status:response.status,reason:"cloudflare-read-failed"};
  return {ok:true,status:response.status,body};
}

const safeDeployment=(d)=>({
  id:typeof d?.id==="string"?d.id:null,
  createdOn:typeof d?.created_on==="string"?d.created_on:null,
  source:typeof d?.source==="string"?d.source:null,
  strategy:typeof d?.strategy==="string"?d.strategy:null,
  versions:Array.isArray(d?.versions)?d.versions.map(v=>({
    versionId:typeof v?.version_id==="string"?v.version_id:null,
    percentage:typeof v?.percentage==="number"?v.percentage:null,
  })):[]
});
const safeSchedule=(s)=>({
  cron:typeof s?.cron==="string"?s.cron:null,
  createdOn:typeof s?.created_on==="string"?s.created_on:null,
  modifiedOn:typeof s?.modified_on==="string"?s.modified_on:null,
});
const safeVersion=(v)=>({
  id:typeof v?.id==="string"?v.id:null,
  createdOn:typeof v?.created_on==="string"?v.created_on:null,
  source:typeof v?.source==="string"?v.source:null,
  tag:typeof v?.annotations?.["workers/tag"]==="string"?v.annotations["workers/tag"]:null,
  message:typeof v?.annotations?.["workers/message"]==="string"?v.annotations["workers/message"].slice(0,240):null,
  previewed:typeof v?.annotations?.["workers/previewed"]==="string"?v.annotations["workers/previewed"]:null,
});

const out={status:"HOLD",operation:"scheduler-s3-dormant-control-evidence",script:SCRIPT};
try{
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token) throw new Error("credential-not-configured");
  const [deployments,schedules,versions,settings]=await Promise.all([
    cf(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT}/deployments`,token),
    cf(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT}/schedules`,token),
    cf(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT}/versions`,token),
    cf(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT}/settings`,token),
  ]);
  out.deploymentsHttpStatus=deployments.status??null;
  out.schedulesHttpStatus=schedules.status??null;
  out.versionsHttpStatus=versions.status??null;
  out.settingsHttpStatus=settings.status??null;
  if(!deployments.ok||!schedules.ok||!versions.ok||!settings.ok) throw new Error("control-read-failed");
  const deploymentList=deployments.body?.result?.deployments??deployments.body?.result??[];
  const scheduleList=schedules.body?.result?.schedules??schedules.body?.result??[];
  const versionList=versions.body?.result?.items??versions.body?.result??[];
  const normalized=Array.isArray(deploymentList)?deploymentList.map(safeDeployment):[];
  out.activeDeployment=normalized[0]??null;
  out.previousDeployment=normalized[1]??null;
  out.schedules=Array.isArray(scheduleList)?scheduleList.map(safeSchedule):[];
  const versionsSafe=Array.isArray(versionList)?versionList.map(safeVersion):[];
  const activeIds=new Set((out.activeDeployment?.versions??[]).map(v=>v.versionId).filter(Boolean));
  out.activeVersions=versionsSafe.filter(v=>activeIds.has(v.id));
  out.recentVersions=versionsSafe.slice(0,8);
  const bindings=Array.isArray(settings.body?.result?.bindings)?settings.body.result.bindings:[];
  const mode=bindings.find(b=>b?.name==="NAGAMEALERT_RECENT_SCHEDULER_MODE");
  out.schedulerMode=typeof mode?.text==="string"?mode.text:typeof mode?.value==="string"?mode.value:null;
  out.activeTrafficTotal=(out.activeDeployment?.versions??[]).reduce((n,v)=>n+(Number(v.percentage)||0),0);
  out.status=out.activeDeployment?.id&&out.activeTrafficTotal===100&&
    out.schedules.some(s=>s.cron==="*/5 * * * *")&&out.activeVersions.length>0&&out.schedulerMode==="rapna-rasff-pilot"
    ?"CONTROL_EVIDENCE_RETRIEVED":"HOLD";
  if(out.status==="HOLD")out.reason="control-contract-incomplete";
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}
let txt=JSON.stringify(out,null,2)+"\n";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-dormant-control-evidence.json",txt);
console.log(txt);
if(out.status!=="CONTROL_EVIDENCE_RETRIEVED")process.exitCode=1;

// S3 release preflight reread 2026-10-03
