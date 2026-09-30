import { writeFile } from "node:fs/promises";

const token=process.env.VIGIA_SYNC_TOKEN;
const url="https://nagamealert.com/api/oecd/sync?observe=1";
const pickState=(state)=>state?{
  status:state.status??null,
  cursor:Number.isFinite(state.cursor)?state.cursor:null,
  cursorKey:typeof state.cursorKey==="string"?state.cursorKey:null,
  totalUnits:Number.isFinite(state.totalUnits)?state.totalUnits:null,
  recordsObserved:Number.isFinite(state.recordsObserved)?state.recordsObserved:null,
  recordsPersisted:Number.isFinite(state.recordsPersisted)?state.recordsPersisted:null,
  newCount:Number.isFinite(state.newCount)?state.newCount:null,
  updatedCount:Number.isFinite(state.updatedCount)?state.updatedCount:null,
  pageErrors:Number.isFinite(state.pageErrors)?state.pageErrors:null,
  detailFailures:Number.isFinite(state.detailFailures)?state.detailFailures:null,
  lastSuccessAt:state.lastSuccessAt??null,
  completedAt:state.completedAt??null,
  lastError:state.lastError?"present":null,
  leaseMode:state.leaseMode??null,
  leaseExpiresAt:state.leaseExpiresAt??null,
}:null;

const out={status:"HOLD",operation:"scheduler-s3-oecd-readonly-discovery-v2"};
try{
  if(!token) throw new Error("credential-not-configured");
  const response=await fetch(url,{
    headers:{Authorization:`Bearer ${token}`},
    redirect:"error",
    signal:AbortSignal.timeout(60000),
  });
  out.httpStatus=response.status;
  const body=await response.json().catch(()=>null);
  if(response.status!==200||!body) throw new Error("oecd-observe-failed");
  const lease=body.lease&&typeof body.lease==="object"?{
    active:typeof body.lease.expiresAt==="string"&&Date.parse(body.lease.expiresAt)>Date.now(),
    mode:body.lease.mode??null,
    expiresAt:body.lease.expiresAt??null,
  }:null;
  out.observedAt=new Date().toISOString();
  out.recent=pickState(body.recent);
  out.historicalReconcile=pickState(body.historicalReconcile);
  out.backfill=pickState(body.backfill);
  out.lease=lease;
  out.revisionCertification=body.revisionCertification?{
    status:body.revisionCertification.status??null,
    completedAt:body.revisionCertification.completedAt??null,
    certifiedAt:body.revisionCertification.certifiedAt??null,
  }:null;
  out.snapshot=body.snapshot?{
    status:body.snapshot.status??null,
    scope:body.snapshot.scope??null,
    createdAt:body.snapshot.createdAt??null,
    completedAt:body.snapshot.completedAt??null,
  }:null;
  const last=Date.parse(out.recent?.lastSuccessAt??"");
  out.recentAgeMinutes=Number.isFinite(last)?Math.round((Date.now()-last)/6000)/10:null;
  out.requiresGapSnapshot=Boolean((out.recent?.cursor??0)>0&&Number.isFinite(last)&&Date.now()-last>7*24*60*60_000);
  out.activationPreflight={
    eligibleNow:Boolean(
      out.recent?.status==="completed" &&
      !lease?.active &&
      out.snapshot?.status!=="backfill-running" &&
      !out.requiresGapSnapshot
    ),
    activeLease:Boolean(lease?.active),
    backfillRunning:out.snapshot?.status==="backfill-running",
    gapRecoveryRequired:out.requiresGapSnapshot,
  };
  out.status="PASS_READONLY";
}catch(error){
  out.reason=error instanceof Error?error.message:"bounded-read-failed";
}
let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token))txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s3-oecd-discovery.json",txt);
console.log(txt);
if(out.status!=="PASS_READONLY")process.exitCode=1;
