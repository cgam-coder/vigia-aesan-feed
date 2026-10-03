import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const TARGET="ee78a683df8e1828a1ef00e1d10b7f80d613e3bf";
const out={status:"HOLD",operation:"scheduler-s3-exact-build-lookup",target:TARGET,matches:[],recent:[]};
try{
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token) throw new Error("credential-not-configured");
  const headers={Authorization:`Bearer ${token}`,Accept:"application/json"};
  const get=async(path)=>{
    const response=await fetch(`${API}/accounts/${ACCOUNT}${path}`,{
      headers,redirect:"error",signal:AbortSignal.timeout(30000)
    });
    const body=await response.json().catch(()=>null);
    if(!response.ok||body?.success===false)throw new Error(`read-http-${response.status}`);
    return body?.result??null;
  };
  const scripts=await get("/workers/scripts");
  const worker=(Array.isArray(scripts)?scripts:[]).find(x=>x?.id==="vigia-runtime");
  if(!worker?.tag)throw new Error("worker-tag-missing");
  const builds=await get(`/builds/workers/${worker.tag}/builds?per_page=25`);
  const list=Array.isArray(builds)?builds:(Array.isArray(builds?.builds)?builds.builds:[]);
  const compact=list.map(b=>({
    id:b?.build_uuid??b?.id??null,status:b?.status??null,buildOutcome:b?.build_outcome??null,
    previewUrl:typeof b?.preview_url==="string"?b.preview_url:null,
    createdOn:b?.created_on??null,modifiedOn:b?.modified_on??null,
    branch:b?.build_trigger_metadata?.branch??null,
    triggerSource:b?.build_trigger_metadata?.build_trigger_source??null,
    commitHash:b?.build_trigger_metadata?.commit_hash??null,
    buildCommand:b?.build_trigger_metadata?.build_command??null,
    deployCommand:b?.build_trigger_metadata?.deploy_command??null
  }));
  out.recent=compact.slice(0,10);
  out.matches=compact.filter(b=>b.commitHash===TARGET);
  const ok=out.matches.find(b=>b.buildOutcome==="success"&&b.deployCommand==="npx wrangler preview");
  out.status=ok?"MATCHED_EXACT_HEAD_PREVIEW":"HOLD";
  if(!ok)out.reason="no-successful-exact-head-preview-yet";
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}
let txt=JSON.stringify(out,null,2)+"\n";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-build-evidence.json",txt);
console.log(txt);
if(out.status!=="MATCHED_EXACT_HEAD_PREVIEW")process.exitCode=1;
