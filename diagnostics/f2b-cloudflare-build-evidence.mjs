const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const BUILD="fb33206b-e1ec-4bdd-a06d-2f100125caab";
const COMMIT="219a3a3fc995227b551141d41c0fa9faeacfcb7a";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token) throw new Error("credential-not-configured");

async function get(path){
  const response=await fetch(API+path,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},signal:AbortSignal.timeout(30000)});
  const body=await response.json().catch(()=>null);
  return {response,body};
}
const detail=await get(`/accounts/${ACCOUNT}/builds/builds/${BUILD}`);
const logs=await get(`/accounts/${ACCOUNT}/builds/builds/${BUILD}/logs`);
const r=detail.body?.result??{};
const metadata=r?.build_trigger_metadata??{};
const raw=logs.body?.result?.lines??[];
const strings=(Array.isArray(raw)?raw:[]).map((entry)=>Array.isArray(entry)?entry.map(String).join(" "):String(entry));
const scrub=(line)=>line.replace(/Bearer\s+\S+/giu,"Bearer [redacted]").replace(/[A-Za-z0-9_-]{80,}/g,"[redacted-long-token]");
const markers=strings.filter((line)=>/(tests \d+|pass \d+|fail \d+|Running Cloudflare CI:|typecheck|lint|Validated .* artifact|post-build|postbuild|node --test tests\/.*\.test\.mjs|✓ built in|problems \(0 errors|Deployment complete|wrangler preview)/iu.test(line))
  .map(scrub).slice(-240);
const out={
  detailHttpStatus:detail.response.status,
  logsHttpStatus:logs.response.status,
  success:detail.response.ok&&detail.body?.success!==false&&logs.response.ok&&logs.body?.success!==false,
  buildOutcome:r?.build_outcome??null,
  status:r?.status??null,
  buildId:BUILD,
  branch:metadata.branch??null,
  commitHash:metadata.commit_hash??null,
  buildCommand:metadata.build_command??null,
  deployCommand:metadata.deploy_command??null,
  createdOn:r?.created_on??null,
  stoppedOn:r?.stopped_on??null,
  markers,
};
console.log("F2B_FINAL_GATE_EVIDENCE "+JSON.stringify(out));
if(!out.success||out.buildOutcome!=="success"||out.commitHash!==COMMIT) process.exit(1);
