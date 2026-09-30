import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const SCRIPT="vigia-runtime";
const BUILD_STOP=Date.parse("2026-09-30T08:31:50.908Z");
const token=process.env.CLOUDFLARE_API_TOKEN;
const api=(path)=>`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}${path}`;
const headers={Authorization:`Bearer ${token}`,Accept:"application/json"};
const out={status:"HOLD",operation:"s3-dormant-production-deployment-read"};

const get=async(path)=>{
  const response=await fetch(api(path),{headers,signal:AbortSignal.timeout(45000)});
  const body=await response.json().catch(()=>null);
  return {response,body};
};

try{
  if(!token) throw new Error("credential-not-configured");

  const deployments=await get(`/workers/scripts/${SCRIPT}/deployments`);
  out.deploymentsHttpStatus=deployments.response.status;
  if(!deployments.response.ok)throw new Error("deployments-read-failed");
  const list=Array.isArray(deployments.body?.result)?deployments.body.result:
    Array.isArray(deployments.body?.result?.deployments)?deployments.body.result.deployments:[];
  out.deployments=list.slice(0,5).map(d=>({
    id:typeof d?.id==="string"?d.id:null,
    createdOn:typeof d?.created_on==="string"?d.created_on:null,
    source:typeof d?.source==="string"?d.source:null,
    versions:Array.isArray(d?.versions)?d.versions.map(v=>({
      versionId:typeof v?.version_id==="string"?v.version_id:null,
      percentage:Number.isFinite(v?.percentage)?v.percentage:null
    })):[]
  }));

  const settings=await get(`/workers/scripts/${SCRIPT}/settings`);
  out.settingsHttpStatus=settings.response.status;
  if(!settings.response.ok)throw new Error("settings-read-failed");
  const bindings=Array.isArray(settings.body?.result?.bindings)?settings.body.result.bindings:[];
  const mode=bindings.find(b=>b?.name==="NAGAMEALERT_RECENT_SCHEDULER_MODE");
  out.schedulerMode=typeof mode?.text==="string"?mode.text:typeof mode?.value==="string"?mode.value:null;

  const active=out.deployments.find(d=>d.versions.some(v=>v.percentage===100))??out.deployments[0]??null;
  out.activeDeployment=active;
  out.deployedAfterBuild=Boolean(active?.createdOn&&Date.parse(active.createdOn)>=BUILD_STOP-30_000);
  out.status=out.deployedAfterBuild&&out.schedulerMode==="rapna-rasff-pilot"?"PASS":"HOLD";
  if(out.status!=="PASS")out.reason="production-deployment-not-yet-visible";
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}

let text=JSON.stringify(out,null,2)+"\n";
if(token&&text.includes(token))text=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-dormant-postmerge.json",text);
console.log(text);
if(out.status!=="PASS")process.exitCode=1;
