const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const BUILD="c4c77ad3-e159-4f78-997e-246e4a5b471e";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token) throw new Error("credential-not-configured");
const get=async(path)=>{
  const response=await fetch(API+path,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},signal:AbortSignal.timeout(30000)});
  const body=await response.json().catch(()=>null);
  return {response,body};
};
const logs=await get(`/accounts/${ACCOUNT}/builds/builds/${BUILD}/logs`);
const raw=logs.body?.result?.lines??[];
const strings=(Array.isArray(raw)?raw:[]).map((entry)=>Array.isArray(entry)?entry.map(String).join(" "):String(entry));
const scrub=(line)=>line
  .replace(/Bearer\s+\S+/giu,"Bearer [redacted]")
  .replace(/[A-Za-z0-9_-]{80,}/g,"[redacted-long-token]");
const focused=strings.filter((line)=>/(warning|warn|eslint|vinext|artifact|timeout|exit|code [1-9]|failed|failure|error|safety-gate-sync\.ts|worker-configuration\.d\.ts|worker\/index\.ts|app\/api\/safety-gate)/iu.test(line))
  .map(scrub).slice(-240);
const tail=strings.slice(-80).map(scrub);
const out={httpStatus:logs.response.status,success:logs.response.ok&&logs.body?.success!==false,focused,tail};
console.log("F2B_FAILED_BUILD_TAIL "+JSON.stringify(out));
if(!out.success) process.exit(1);
