import { writeFile } from "node:fs/promises";
const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const SCRIPT="vigia-runtime";
const token=process.env.CLOUDFLARE_API_TOKEN;
const out={status:"HOLD",operation:"cloudflare-worker-versions-read",versions:[]};
try{
  if(!token) throw new Error("missing-token");
  const res=await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}/versions`,{
    headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
    signal:AbortSignal.timeout(30000)
  });
  out.httpStatus=res.status;
  if(!res.ok) throw new Error("read-failed");
  const body=await res.json();
  const list=body?.result?.items ?? body?.result ?? [];
  out.versions=(Array.isArray(list)?list:[]).slice(0,12).map(v=>({
    id:typeof v?.id==="string"?v.id:null,
    createdOn:typeof v?.created_on==="string"?v.created_on:null,
    source:typeof v?.source==="string"?v.source:null,
    tag:typeof v?.annotations?.["workers/tag"]==="string"?v.annotations["workers/tag"]:null,
    message:typeof v?.annotations?.["workers/message"]==="string"?v.annotations["workers/message"].slice(0,180):null,
    preview:typeof v?.annotations?.["workers/previewed"]==="string"?v.annotations["workers/previewed"]:null
  }));
  out.status="EVIDENCE_RETRIEVED";
}catch{out.reason="bounded-read-failed";}
const text=JSON.stringify(out,null,2)+"\n";
if(token&&text.includes(token)) throw new Error("secret-guard");
await writeFile("scheduler-s1-version-evidence.json",text);
console.log(text);
if(out.status!=="EVIDENCE_RETRIEVED") process.exitCode=1;
