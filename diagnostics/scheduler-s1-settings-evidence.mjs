import { writeFile } from "node:fs/promises";
const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const SCRIPT="vigia-runtime";
const token=process.env.CLOUDFLARE_API_TOKEN;
const out={status:"HOLD",operation:"cloudflare-worker-settings-read",bindings:[],vars:[]};
try{
  if(!token) throw new Error("missing-token");
  const res=await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}/settings`,{
    headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
    signal:AbortSignal.timeout(30000)
  });
  out.httpStatus=res.status;
  if(!res.ok) throw new Error("read-failed");
  const body=await res.json();
  const result=body?.result ?? {};
  const bindings=Array.isArray(result.bindings)?result.bindings:[];
  out.bindings=bindings.map(b=>({
    name:typeof b?.name==="string"?b.name:null,
    type:typeof b?.type==="string"?b.type:null,
    id:typeof b?.id==="string"?b.id:null,
    namespaceId:typeof b?.namespace_id==="string"?b.namespace_id:null,
    databaseId:typeof b?.database_id==="string"?b.database_id:null
  })).filter(b=>b.name);
  out.status="EVIDENCE_RETRIEVED";
}catch{out.reason="bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token)) txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s1-settings-evidence.json",txt);
console.log(txt);
if(out.status!=="EVIDENCE_RETRIEVED") process.exitCode=1;
