const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const BUILD="c4c77ad3-e159-4f78-997e-246e4a5b471e";
const COMMIT="dcff97adad8ae9e5ebb0a110b9b08e4f6d238ea8";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token) throw new Error("credential-not-configured");

const response=await fetch(`${API}/accounts/${ACCOUNT}/builds/builds/${BUILD}`,{
  headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
  signal:AbortSignal.timeout(30000),
});
const body=await response.json();
const r=body?.result??null;
const metadata=r?.build_trigger_metadata??{};

const safeScalar=(value)=>typeof value==="string"||typeof value==="number"||typeof value==="boolean"?value:null;
const truncate=(value)=>typeof value==="string"?value.slice(0,1000):null;
const safeStage=(stage)=>({
  keys:stage&&typeof stage==="object"?Object.keys(stage).sort():[],
  name:safeScalar(stage?.name)??safeScalar(stage?.stage)??null,
  status:safeScalar(stage?.status)??null,
  outcome:safeScalar(stage?.outcome)??safeScalar(stage?.build_outcome)??null,
  error:truncate(stage?.error)??truncate(stage?.message)??truncate(stage?.failure_reason)??null,
});

const out={
  httpStatus:response.status,
  success:response.ok&&body?.success!==false,
  buildId:BUILD,
  resultKeys:r&&typeof r==="object"?Object.keys(r).sort():[],
  buildOutcome:r?.build_outcome??null,
  status:safeScalar(r?.status),
  failureReason:truncate(r?.failure_reason)??truncate(r?.error)??truncate(r?.message),
  createdOn:r?.created_on??null,
  modifiedOn:r?.modified_on??null,
  previewUrl:typeof r?.preview_url==="string"?r.preview_url:null,
  branch:metadata.branch??null,
  commitHash:metadata.commit_hash??null,
  triggerSource:metadata.build_trigger_source??null,
  buildCommand:metadata.build_command??null,
  deployCommand:metadata.deploy_command??null,
  rootDirectory:metadata.root_directory??null,
  stageKeys:r?.stages&&typeof r.stages==="object"?Object.keys(r.stages).sort():[],
  stages:Array.isArray(r?.stages)?r.stages.map(safeStage):
    r?.stages&&typeof r.stages==="object"?Object.entries(r.stages).map(([name,stage])=>({name,...safeStage(stage)})):[],
};
console.log("F2B_FAILED_BUILD_EVIDENCE "+JSON.stringify(out));
if(!out.success||out.commitHash!==COMMIT||out.buildId!==BUILD) process.exit(1);
