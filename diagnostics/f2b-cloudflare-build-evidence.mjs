const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const BUILD="c4c77ad3-e159-4f78-997e-246e4a5b471e";
const COMMIT="dcff97adad8ae9e5ebb0a110b9b08e4f6d238ea8";
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

const detail=await get(`/accounts/${ACCOUNT}/builds/builds/${BUILD}`);
const r=detail.body?.result??{};
const metadata=r?.build_trigger_metadata??{};
const logs=await get(`/accounts/${ACCOUNT}/builds/builds/${BUILD}/logs`);
const raw=logs.body?.result?.lines??[];
const strings=(Array.isArray(raw)?raw:[]).map((entry)=>
  Array.isArray(entry)?entry.map(String).join(" "):String(entry));
const safeLines=strings
  .filter((line)=>/(error|failed|failure|not ok|npm ERR|typescript|tsc|lint|AssertionError|ERR_|safety|reconcile|delta|build:cloudflare|tests?)/iu.test(line))
  .map((line)=>line
    .replace(/Bearer\s+\S+/giu,"Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]{80,}/g,"[redacted-long-token]"))
  .slice(-300);

const out={
  detailHttpStatus:detail.response.status,
  logsHttpStatus:logs.response.status,
  success:detail.response.ok&&detail.body?.success!==false&&logs.response.ok&&logs.body?.success!==false,
  buildId:BUILD,
  buildOutcome:r?.build_outcome??null,
  status:r?.status??null,
  commitHash:metadata.commit_hash??null,
  branch:metadata.branch??null,
  buildCommand:metadata.build_command??null,
  deployCommand:metadata.deploy_command??null,
  createdOn:r?.created_on??null,
  stoppedOn:r?.stopped_on??null,
  lines:safeLines,
};
console.log("F2B_FAILED_BUILD_LOGS "+JSON.stringify(out));
if(!out.success||out.commitHash!==COMMIT) process.exit(1);
