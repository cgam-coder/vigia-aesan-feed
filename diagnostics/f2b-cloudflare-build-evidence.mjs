const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const SCRIPT="vigia-runtime";
const TARGET="a9af3ec1ffd2de67ac5677754ab8a7d1d1bb1320";
const EXPECTED_SCHEDULER_MODE="rapna-rasff-pilot";
const PREVIOUS_VERSION="6cea920e-886f-47d1-8241-d586efc8c861";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token) throw new Error("credential-not-configured");

async function get(path){
  const response=await fetch(API+path,{
    headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
    signal:AbortSignal.timeout(30000),
  });
  const body=await response.json().catch(()=>null);
  return {response,body};
}
const scripts=await get(`/accounts/${ACCOUNT}/workers/scripts`);
const worker=(scripts.body?.result??[]).find((entry)=>entry?.id===SCRIPT);
const tag=worker?.tag??null;
if(!tag) throw new Error("worker-tag-missing");

const [buildsR,deploymentsR,versionsR,settingsR]=await Promise.all([
  get(`/accounts/${ACCOUNT}/builds/workers/${tag}/builds`),
  get(`/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}/deployments`),
  get(`/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}/versions`),
  get(`/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}/settings`),
]);

const buildList=Array.isArray(buildsR.body?.result)?buildsR.body.result:
  Array.isArray(buildsR.body?.result?.items)?buildsR.body.result.items:
  Array.isArray(buildsR.body?.result?.builds)?buildsR.body.result.builds:[];
const safeBuild=(b)=>({
  id:b?.build_uuid??b?.id??null,
  status:b?.status??null,
  outcome:b?.build_outcome??null,
  createdOn:b?.created_on??null,
  modifiedOn:b?.modified_on??null,
  branch:b?.build_trigger_metadata?.branch??null,
  commitHash:b?.build_trigger_metadata?.commit_hash??null,
  buildCommand:b?.build_trigger_metadata?.build_command??null,
  deployCommand:b?.build_trigger_metadata?.deploy_command??null,
  previewUrl:typeof b?.preview_url==="string"?b.preview_url:null,
});
const builds=buildList.map(safeBuild);
const targetBuilds=builds.filter((b)=>b.commitHash===TARGET);

const deploymentList=deploymentsR.body?.result?.deployments??deploymentsR.body?.result??[];
const deployments=(Array.isArray(deploymentList)?deploymentList:[]).slice(0,6).map((d)=>({
  id:d?.id??null,
  createdOn:d?.created_on??null,
  source:d?.source??null,
  strategy:d?.strategy??null,
  versions:Array.isArray(d?.versions)?d.versions.map((v)=>({
    versionId:v?.version_id??null,
    percentage:Number(v?.percentage??0),
  })):[],
}));
const active=deployments[0]??null;
const activeVersion=active?.versions?.length===1?active.versions[0]?.versionId:null;
const traffic=(active?.versions??[]).reduce((sum,v)=>sum+(Number(v.percentage)||0),0);

const versionList=versionsR.body?.result?.items??versionsR.body?.result??[];
const versions=(Array.isArray(versionList)?versionList:[]).slice(0,10).map((v)=>({
  id:v?.id??null,
  createdOn:v?.created_on??null,
  source:v?.source??null,
  message:typeof v?.annotations?.["workers/message"]==="string"?v.annotations["workers/message"].slice(0,240):null,
  previewed:v?.annotations?.["workers/previewed"]??null,
}));
const activeVersionMeta=versions.find((v)=>v.id===activeVersion)??null;

const bindings=Array.isArray(settingsR.body?.result?.bindings)?settingsR.body.result.bindings:[];
const binding=(name)=>{
  const b=bindings.find((x)=>x?.name===name);
  return typeof b?.text==="string"?b.text:typeof b?.value==="string"?b.value:null;
};
const schedulerMode=binding("NAGAMEALERT_RECENT_SCHEDULER_MODE");
const safetyGateMode=binding("NAGAMEALERT_SAFETY_GATE_RECENT_MODE");

const productionBuild=targetBuilds.find((b)=>
  b.status==="stopped"&&b.outcome==="success"&&
  b.branch==="main"&&b.deployCommand==="npx wrangler deploy")??null;
const previousPreserved=deployments.slice(1).some((d)=>
  d.versions.some((v)=>v.versionId===PREVIOUS_VERSION&&v.percentage===100));

const pass=Boolean(
  productionBuild&&active?.id&&activeVersion&&traffic===100&&
  schedulerMode===EXPECTED_SCHEDULER_MODE&&
  safetyGateMode!=="delta"&&previousPreserved
);
const out={
  status:pass?"PASS":"HOLD",
  targetCommit:TARGET,
  workerTag:tag,
  http:{builds:buildsR.response.status,deployments:deploymentsR.response.status,versions:versionsR.response.status,settings:settingsR.response.status},
  targetBuilds,
  productionBuild,
  activeDeployment:active,
  activeVersion,
  activeVersionMeta,
  traffic,
  schedulerMode,
  safetyGateMode,
  previousVersion:PREVIOUS_VERSION,
  previousPreserved,
  recentDeployments:deployments,
  recentVersions:versions,
};
console.log("F2A_PRODUCTION_GATE "+JSON.stringify(out));
if(!pass) process.exit(1);
