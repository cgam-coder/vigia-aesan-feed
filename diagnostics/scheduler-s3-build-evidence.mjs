import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const BUILD="33c2ba64-9032-4667-9dc4-7ab54185a4f4";
const DEPLOYMENT="4ec6e459-8937-4746-96c7-0ae522a202c4";
const out={status:"HOLD",operation:"f2b-preview-path-forensics",build:null,deployment:null};
try{
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token) throw new Error("credential-not-configured");
  const headers={Authorization:`Bearer ${token}`,Accept:"application/json"};
  const get=async(url)=>{
    const r=await fetch(url,{headers,redirect:"error",signal:AbortSignal.timeout(30000)});
    const j=await r.json().catch(()=>null);
    if(!r.ok||j?.success===false) throw new Error(`http-${r.status}`);
    return j?.result??null;
  };
  const b=await get(`${API}/accounts/${ACCOUNT}/builds/builds/${BUILD}`);
  out.build={
    id:b?.build_uuid??BUILD,status:b?.status??null,outcome:b?.build_outcome??null,
    previewUrl:b?.preview_url??null,createdOn:b?.created_on??null,modifiedOn:b?.modified_on??null,
    trigger:b?.build_trigger_metadata?{
      branch:b.build_trigger_metadata.branch??null,
      triggerSource:b.build_trigger_metadata.build_trigger_source??null,
      commitHash:b.build_trigger_metadata.commit_hash??null,
      repoName:b.build_trigger_metadata.repo_name??null,
      buildCommand:b.build_trigger_metadata.build_command??null,
      deployCommand:b.build_trigger_metadata.deploy_command??null
    }:null
  };
  const deps=await get(`${API}/accounts/${ACCOUNT}/workers/scripts/vigia-runtime/deployments`);
  const list=Array.isArray(deps?.deployments)?deps.deployments:(Array.isArray(deps)?deps:[]);
  const d=list.find(x=>x?.id===DEPLOYMENT)??null;
  out.deployment=d?{id:d.id,createdOn:d.created_on??null,source:d.source??null,versions:d.versions??null}:null;
  out.status="EVIDENCE_RETRIEVED";
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}
let txt=JSON.stringify(out,null,2)+"\n";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-build-evidence.json",txt);
console.log(txt);
if(out.status!=="EVIDENCE_RETRIEVED")process.exitCode=1;
