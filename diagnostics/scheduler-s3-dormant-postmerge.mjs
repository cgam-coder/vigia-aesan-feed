import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const BUILD="dcebbbf8-b281-4b97-ab30-9d63ffafe199";
const token=process.env.CLOUDFLARE_API_TOKEN;
const out={status:"HOLD",operation:"cloudflare-main-build-diagnosis",buildUuid:BUILD};

const primitive=(value)=>value===null||typeof value==="boolean"||typeof value==="number"||typeof value==="string";
const pick=(object,keys)=>Object.fromEntries(Object.entries(object??{}).filter(([key,value])=>keys.includes(key)&&primitive(value)));

try{
  if(!token) throw new Error("credential-not-configured");
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/builds/builds/${BUILD}`,{
    headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
    signal:AbortSignal.timeout(45000)
  });
  out.httpStatus=response.status;
  const body=await response.json().catch(()=>null);
  if(!response.ok){
    out.reason=[401,403].includes(response.status)?"workers-ci-read-not-authorized":"build-read-failed";
  }else if(body?.success===false||body?.errors?.length){
    out.reason="build-api-error";
  }else{
    const build=body?.result??{};
    out.buildKeys=Object.keys(build).sort();
    out.build=pick(build,[
      "build_uuid","build_outcome","status","stage","created_on","modified_on","completed_on",
      "script_name","worker_name","script_id","external_script_id","worker_tag","version_id"
    ]);
    const meta=build.build_trigger_metadata??{};
    out.triggerMetadataKeys=Object.keys(meta).sort();
    out.triggerMetadata=pick(meta,[
      "branch","commit_hash","build_command","deploy_command","preview_command","root_directory",
      "build_trigger_source","trigger_uuid","repository_name","repo_name","provider_type"
    ]);
    const config=build.build_config??{};
    out.buildConfigKeys=Object.keys(config).sort();
    out.buildConfig=pick(config,[
      "build_command","deploy_command","preview_command","root_directory","production_branch"
    ]);
    out.status="EVIDENCE_RETRIEVED";
  }
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}

let text=JSON.stringify(out,null,2)+"\n";
if(token&&text.includes(token))text=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-dormant-postmerge.json",text);
console.log(text);
if(out.status!=="EVIDENCE_RETRIEVED")process.exitCode=1;
