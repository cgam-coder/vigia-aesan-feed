import { writeFile } from "node:fs/promises";
const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const TARGET="3077d7968b94a3253c45afff05ccae40ef7bffff";
const out={status:"HOLD",operation:"f2b-route-production-build-status",target:TARGET,matches:[]};
try{
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token) throw new Error("credential-not-configured");
  const headers={Authorization:`Bearer ${token}`,Accept:"application/json"};
  const get=async(path)=>{
    const r=await fetch(`${API}/accounts/${ACCOUNT}${path}`,{headers,redirect:"error",signal:AbortSignal.timeout(30000)});
    const j=await r.json().catch(()=>null);
    if(!r.ok||j?.success===false)throw new Error(`http-${r.status}`);
    return j?.result??null;
  };
  const scripts=await get("/workers/scripts");
  const worker=(Array.isArray(scripts)?scripts:[]).find(x=>x?.id==="vigia-runtime");
  if(!worker?.tag)throw new Error("worker-tag-missing");
  const builds=await get(`/builds/workers/${worker.tag}/builds?per_page=20`);
  const list=Array.isArray(builds)?builds:(Array.isArray(builds?.builds)?builds.builds:[]);
  out.matches=list.filter(b=>b?.build_trigger_metadata?.commit_hash===TARGET).map(b=>({
    id:b?.build_uuid??b?.id??null,status:b?.status??null,outcome:b?.build_outcome??null,
    createdOn:b?.created_on??null,modifiedOn:b?.modified_on??null,
    branch:b?.build_trigger_metadata?.branch??null,triggerSource:b?.build_trigger_metadata?.build_trigger_source??null,
    buildCommand:b?.build_trigger_metadata?.build_command??null,deployCommand:b?.build_trigger_metadata?.deploy_command??null
  }));
  const terminal=out.matches.find(b=>b.status==="stopped");
  out.status=terminal ? (terminal.outcome==="success"?"PASS":"FAIL") :
    out.matches.length ? "IN_PROGRESS" : "NOT_SEEN";
}catch(error){out.reason=error instanceof Error?error.message:"bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-build-evidence.json",txt);
console.log(txt);
if(["FAIL","HOLD"].includes(out.status))process.exitCode=1;
