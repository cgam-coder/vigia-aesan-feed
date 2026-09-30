import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const SCRIPT="vigia-runtime";
const BUILD="dcebbbf8-b281-4b97-ab30-9d63ffafe199";
const token=process.env.CLOUDFLARE_API_TOKEN;
const api=(path)=>`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}${path}`;
const headers={Authorization:`Bearer ${token}`,Accept:"application/json"};
const out={status:"HOLD",operation:"cloudflare-build-trigger-diagnosis",script:SCRIPT,buildUuid:BUILD};

const get=async(path)=>{
  const response=await fetch(api(path),{headers,signal:AbortSignal.timeout(45000)});
  const body=await response.json().catch(()=>null);
  return {response,body};
};
const primitive=(value)=>value===null||typeof value==="boolean"||typeof value==="number"||typeof value==="string";
const pick=(object,keys)=>Object.fromEntries(Object.entries(object??{}).filter(([key,value])=>keys.includes(key)&&primitive(value)));

try{
  if(!token) throw new Error("credential-not-configured");

  const scripts=await get("/workers/scripts");
  out.scriptsHttpStatus=scripts.response.status;
  if(!scripts.response.ok) throw new Error("scripts-read-failed");
  const worker=(Array.isArray(scripts.body?.result)?scripts.body.result:[]).find(item=>item?.id===SCRIPT);
  if(!worker||typeof worker.tag!=="string") throw new Error("worker-tag-not-found");
  out.worker={name:SCRIPT,tag:worker.tag};

  const triggers=await get(`/builds/workers/${worker.tag}/triggers`);
  out.triggersHttpStatus=triggers.response.status;
  if(!triggers.response.ok){
    out.reason=[401,403].includes(triggers.response.status)?"workers-builds-config-read-not-authorized":"triggers-read-failed";
    throw new Error(out.reason);
  }
  out.triggers=(Array.isArray(triggers.body?.result)?triggers.body.result:[]).map(trigger=>({
    ...pick(trigger,["trigger_uuid","trigger_name","build_command","deploy_command","root_directory","build_caching_enabled"]),
    branchIncludes:Array.isArray(trigger?.branch_includes)?trigger.branch_includes:[],
    branchExcludes:Array.isArray(trigger?.branch_excludes)?trigger.branch_excludes:[],
    pathIncludes:Array.isArray(trigger?.path_includes)?trigger.path_includes:[],
    pathExcludes:Array.isArray(trigger?.path_excludes)?trigger.path_excludes:[],
  }));

  const build=await get(`/builds/builds/${BUILD}`);
  out.buildHttpStatus=build.response.status;
  if(!build.response.ok) throw new Error("build-read-failed");
  const result=build.body?.result??{};
  out.build={
    ...pick(result,["build_uuid","status","build_outcome","created_on","modified_on"]),
    trigger:pick(result.trigger??{},["trigger_uuid","trigger_name"]),
    triggerMetadata:pick(result.build_trigger_metadata??{},[
      "branch","commit_hash","build_command","deploy_command","root_directory","build_trigger_source"
    ]),
  };

  const production=out.triggers.find(t=>t.branchIncludes.includes("main")&&!t.branchExcludes.includes("main"))??null;
  const preview=out.triggers.find(t=>t.branchIncludes.includes("*")&&t.branchExcludes.includes("main"))??null;
  out.classification={
    productionTriggerUuid:production?.trigger_uuid??null,
    productionDeployCommand:production?.deploy_command??null,
    previewTriggerUuid:preview?.trigger_uuid??null,
    previewDeployCommand:preview?.deploy_command??null,
    productionMisconfigured:Boolean(production&&production.deploy_command!=="npx wrangler deploy"),
  };
  out.status="EVIDENCE_RETRIEVED";
}catch(error){
  if(!out.reason)out.reason=error instanceof Error?error.message:"bounded-read-failed";
}

let text=JSON.stringify(out,null,2)+"\n";
if(token&&text.includes(token))text=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-dormant-postmerge.json",text);
console.log(text);
if(out.status!=="EVIDENCE_RETRIEVED")process.exitCode=1;
