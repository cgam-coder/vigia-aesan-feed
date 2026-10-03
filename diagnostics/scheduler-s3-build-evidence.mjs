import { writeFile } from "node:fs/promises";
const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const BUILD="f50d09b3-53c8-4948-bac9-f27ab2fe408c";
const API="https://api.cloudflare.com/client/v4";
const out={status:"HOLD",operation:"f2b-diagnostic-build-status",buildId:BUILD};
try{
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token) throw new Error("credential-not-configured");
  const r=await fetch(`${API}/accounts/${ACCOUNT}/builds/builds/${BUILD}`,{
    headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
    signal:AbortSignal.timeout(30000)
  });
  const j=await r.json().catch(()=>null);
  if(!r.ok||j?.success===false) throw new Error(`http-${r.status}`);
  const b=j?.result??null;
  out.build={
    status:b?.status??null,outcome:b?.build_outcome??null,createdOn:b?.created_on??null,modifiedOn:b?.modified_on??null,
    branch:b?.build_trigger_metadata?.branch??null,commitHash:b?.build_trigger_metadata?.commit_hash??null,
    buildCommand:b?.build_trigger_metadata?.build_command??null,deployCommand:b?.build_trigger_metadata?.deploy_command??null
  };
  out.status=b?.status==="stopped"&&b?.build_outcome==="success"?"PASS":
    b?.status==="stopped"?"FAIL":"IN_PROGRESS";
}catch(error){out.reason=error instanceof Error?error.message:"bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-build-evidence.json",txt);
console.log(txt);
if(out.status==="FAIL"||out.status==="HOLD")process.exitCode=1;
