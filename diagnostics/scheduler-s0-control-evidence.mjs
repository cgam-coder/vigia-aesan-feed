import { writeFile } from "node:fs/promises";

const ACCOUNT_ID = "9c1807c68493f14259248b5f5782cc6f";
const SCRIPT = "vigia-runtime";
const API = "https://api.cloudflare.com/client/v4";

async function cf(path, token) {
  const response = await fetch(API + path, {
    method:"GET",
    redirect:"error",
    headers:{ Authorization:`Bearer ${token}`, Accept:"application/json" },
    signal:AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) return { ok:false, status:response.status, reason:"cloudflare-read-failed" };
  let body;
  try { body = JSON.parse(text); } catch { return { ok:false, status:response.status, reason:"invalid-json" }; }
  if (body?.success === false || body?.errors?.length) return { ok:false, status:response.status, reason:"cloudflare-api-error" };
  return { ok:true, status:response.status, body };
}

const safeDeployment = (d) => ({
  id: typeof d?.id === "string" ? d.id : null,
  createdOn: typeof d?.created_on === "string" ? d.created_on : null,
  source: typeof d?.source === "string" ? d.source : null,
  strategy: typeof d?.strategy === "string" ? d.strategy : null,
  versions: Array.isArray(d?.versions) ? d.versions.map(v => ({
    versionId: typeof v?.version_id === "string" ? v.version_id : null,
    percentage: typeof v?.percentage === "number" ? v.percentage : null,
  })) : [],
});

const safeSchedule = (s) => ({
  cron: typeof s?.cron === "string" ? s.cron : null,
  createdOn: typeof s?.created_on === "string" ? s.created_on : null,
  modifiedOn: typeof s?.modified_on === "string" ? s.modified_on : null,
});

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  let report = { status:"HOLD", operation:"cloudflare-s0-control-read", script:SCRIPT };
  if (!token) {
    report.reason = "credential-not-configured";
  } else {
    const [deployments, schedules] = await Promise.all([
      cf(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT}/deployments`, token),
      cf(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT}/schedules`, token),
    ]);
    report.deploymentsHttpStatus = deployments.status ?? null;
    report.schedulesHttpStatus = schedules.status ?? null;
    if (!deployments.ok || !schedules.ok) {
      report.reason = !deployments.ok ? deployments.reason : schedules.reason;
    } else {
      const list = deployments.body?.result?.deployments ?? deployments.body?.result ?? [];
      const sched = schedules.body?.result?.schedules ?? schedules.body?.result ?? [];
      const normalized = Array.isArray(list) ? list.map(safeDeployment) : [];
      report.activeDeployment = normalized[0] ?? null;
      report.previousDeployment = normalized[1] ?? null;
      report.schedules = Array.isArray(sched) ? sched.map(safeSchedule) : [];
      const active = report.activeDeployment;
      const traffic = Array.isArray(active?.versions) ? active.versions.reduce((n,v)=>n+(Number(v.percentage)||0),0) : 0;
      report.activeTrafficTotal = traffic;
      report.status = active?.id && traffic === 100 && report.schedules.some(s=>s.cron === "*/5 * * * *")
        ? "CONTROL_EVIDENCE_RETRIEVED" : "HOLD";
      if (report.status !== "CONTROL_EVIDENCE_RETRIEVED") report.reason = "control-contract-incomplete";
    }
  }
  let output = JSON.stringify(report, null, 2);
  if (token && output.includes(token)) output = JSON.stringify({status:"HOLD",reason:"output-secret-guard"});
  await writeFile("scheduler-s0-control-evidence.json", output + "\n");
  console.log(output);
  if (report.status !== "CONTROL_EVIDENCE_RETRIEVED") process.exitCode = 1;
}
main().catch(async () => {
  const output = JSON.stringify({status:"HOLD",reason:"bounded-read-failed"}, null, 2);
  await writeFile("scheduler-s0-control-evidence.json", output + "\n");
  console.log(output);
  process.exitCode = 1;
});
