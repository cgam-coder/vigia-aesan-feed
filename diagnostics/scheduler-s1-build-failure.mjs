import { writeFile } from "node:fs/promises";
const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const BUILD="c66febd0-b931-45f4-9d65-daa81fee8d7c";
const token=process.env.CLOUDFLARE_API_TOKEN;
const api="https://api.cloudflare.com/client/v4";
const out={status:"HOLD",operation:"f2a-production-build-read",buildUuid:BUILD,detail:null,lines:[]};
async function get(path){
  const r=await fetch(api+path,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},signal:AbortSignal.timeout(30000)});
  const b=await r.json().catch(()=>null);
  return {r,b};
}
try{
  if(!token) throw new Error("missing-token");
  const detail=await get(`/accounts/${ACCOUNT}/builds/builds/${BUILD}`);
  out.detailHttpStatus=detail.r.status;
  if(!detail.r.ok||detail.b?.success===false) throw new Error("detail-read-failed");
  const d=detail.b?.result??{};
  out.detail={
    status:d.status??null,
    buildOutcome:d.build_outcome??null,
    commitHash:d.build_trigger_metadata?.commit_hash??null,
    branch:d.build_trigger_metadata?.branch??null,
    buildCommand:d.build_trigger_metadata?.build_command??null,
    deployCommand:d.build_trigger_metadata?.deploy_command??null,
    createdOn:d.created_on??null,
    runningOn:d.running_on??null,
    stoppedOn:d.stopped_on??null,
  };
  const logs=await get(`/accounts/${ACCOUNT}/builds/builds/${BUILD}/logs`);
  out.logsHttpStatus=logs.r.status;
  if(!logs.r.ok||logs.b?.success===false) throw new Error("logs-read-failed");
  const raw=logs.b?.result?.lines??[];
  const strings=(Array.isArray(raw)?raw:[]).map(x=>Array.isArray(x)?x.map(String).join(" "):String(x));
  const safe=strings.filter(line=>/(error|failed|failure|npm ERR|tsc|typescript|lint|build:cloudflare|wrangler|deploy|ENOENT|EACCES|AssertionError|ERR_)/iu.test(line))
    .map(line=>line.replace(/[A-Za-z0-9_-]{24,}/g,m=>m.length>80?"[redacted-long-token]":m)).slice(-240);
  out.lines=safe;
  out.status="EVIDENCE_RETRIEVED";
}catch(e){out.reason=e instanceof Error?e.message:"bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token)) txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s1-build-failure.json",txt);
console.log(txt);
if(out.status!=="EVIDENCE_RETRIEVED") process.exitCode=1;
