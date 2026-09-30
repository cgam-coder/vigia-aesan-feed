import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const BUILDS=[
  "dcebbbf8-b281-4b97-ab30-9d63ffafe199",
  "b284715c-f164-4a9b-b918-41a16ceb81c4"
];

const out={status:"HOLD",operation:"scheduler-s3-build-evidence",builds:[]};
try{
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token) throw new Error("credential-not-configured");
  for(const id of BUILDS){
    const response=await fetch(`${API}/accounts/${ACCOUNT}/builds/builds/${id}`,{
      headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
      signal:AbortSignal.timeout(30000),
    });
    const body=await response.json().catch(()=>null);
    const r=body?.result??null;
    out.builds.push({
      id,
      httpStatus:response.status,
      success:response.ok&&body?.success!==false,
      buildOutcome:r?.build_outcome??null,
      createdOn:r?.created_on??null,
      modifiedOn:r?.modified_on??null,
      previewUrl:typeof r?.preview_url==="string"?r.preview_url:null,
      trigger:r?.build_trigger_metadata?{
        branch:r.build_trigger_metadata.branch??null,
        triggerSource:r.build_trigger_metadata.build_trigger_source??null,
        commitHash:r.build_trigger_metadata.commit_hash??null,
        commitMessage:typeof r.build_trigger_metadata.commit_message==="string"
          ?r.build_trigger_metadata.commit_message.slice(0,240):null,
        providerType:r.build_trigger_metadata.provider_type??null,
        repoName:r.build_trigger_metadata.repo_name??null,
        deployCommand:r.build_trigger_metadata.deploy_command??null,
      }:null,
    });
  }
  const main=out.builds.find(b=>b.success&&b.buildOutcome==="success"&&
    b.trigger?.branch==="main"&&b.trigger?.commitHash==="fe455fbdf4132b4aa988a5069264de2fa3195412");
  out.matchedMainBuildId=main?.id??null;
  out.status=main?"MATCHED_MAIN_BUILD":"HOLD";
  if(!main)out.reason="no-successful-main-build-for-merge";
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}
let txt=JSON.stringify(out,null,2)+"\n";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-build-evidence.json",txt);
console.log(txt);
if(out.status!=="MATCHED_MAIN_BUILD")process.exitCode=1;
