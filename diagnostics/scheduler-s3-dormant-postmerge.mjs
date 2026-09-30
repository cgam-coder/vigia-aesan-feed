import { writeFile } from "node:fs/promises";

const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const SCRIPT="vigia-runtime";
const TAG="c16d1153847b48f7ba2245915cfd97ab";
const BUILDS=[
  "559d529a-46df-4a39-a61d-34e68ce4eb72",
  "dcebbbf8-b281-4b97-ab30-9d63ffafe199"
];
const token=process.env.CLOUDFLARE_API_TOKEN;
const api=(path)=>`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}${path}`;
const headers={Authorization:`Bearer ${token}`,Accept:"application/json"};
const out={status:"HOLD",operation:"cloudflare-build-route-comparison",script:SCRIPT,workerTag:TAG,builds:[]};

const get=async(path)=>{
  const response=await fetch(api(path),{headers,signal:AbortSignal.timeout(45000)});
  const body=await response.json().catch(()=>null);
  return {response,body};
};
const primitive=(value)=>value===null||typeof value==="boolean"||typeof value==="number"||typeof value==="string";
const pick=(object,keys)=>Object.fromEntries(Object.entries(object??{}).filter(([key,value])=>keys.includes(key)&&primitive(value)));
const cleanBuild=(result)=>({
  ...pick(result,["build_uuid","status","build_outcome","created_on","modified_on","stopped_on","preview_url"]),
  trigger:pick(result?.trigger??{},["trigger_uuid","trigger_name"]),
  metadata:pick(result?.build_trigger_metadata??{},[
    "branch","commit_hash","build_command","deploy_command","root_directory","build_trigger_source"
  ]),
});

try{
  if(!token) throw new Error("credential-not-configured");
  for(const uuid of BUILDS){
    const response=await get(`/builds/builds/${uuid}`);
    out.builds.push({httpStatus:response.response.status,...(response.response.ok?cleanBuild(response.body?.result??{}):{})});
  }

  const history=await get(`/builds/workers/${TAG}/builds`);
  out.historyHttpStatus=history.response.status;
  if(!history.response.ok) throw new Error("build-history-read-failed");
  const list=Array.isArray(history.body?.result)?history.body.result:
    Array.isArray(history.body?.result?.builds)?history.body.result.builds:[];
  out.recentBuilds=list.slice(0,12).map(cleanBuild);

  const triggers=await get(`/builds/workers/${TAG}/triggers`);
  out.triggersHttpStatus=triggers.response.status;
  if(!triggers.response.ok) throw new Error("triggers-read-failed");
  out.currentTriggers=(Array.isArray(triggers.body?.result)?triggers.body.result:[]).map(trigger=>({
    ...pick(trigger,["trigger_uuid","trigger_name","build_command","deploy_command","root_directory"]),
    branchIncludes:Array.isArray(trigger?.branch_includes)?trigger.branch_includes:[],
    branchExcludes:Array.isArray(trigger?.branch_excludes)?trigger.branch_excludes:[],
  }));
  out.status="EVIDENCE_RETRIEVED";
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}

let text=JSON.stringify(out,null,2)+"\n";
if(token&&text.includes(token))text=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-dormant-postmerge.json",text);
console.log(text);
if(out.status!=="EVIDENCE_RETRIEVED")process.exitCode=1;
