import { writeFile } from "node:fs/promises";
const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const SCRIPT="vigia-runtime";
const token=process.env.CLOUDFLARE_API_TOKEN;
const out={status:"HOLD",operation:"cloudflare-build-trigger-read",worker:null,triggers:[]};
const get=async (url)=>{
  const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},signal:AbortSignal.timeout(30000)});
  const body=await r.json().catch(()=>null);
  return {status:r.status,ok:r.ok,body};
};
try{
  if(!token) throw new Error("missing-token");
  const scripts=await get(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts`);
  out.scriptsHttpStatus=scripts.status;
  if(!scripts.ok) throw new Error("scripts-read-failed");
  const worker=(scripts.body?.result??[]).find(x=>x?.id===SCRIPT);
  if(!worker?.tag) throw new Error("worker-tag-missing");
  out.worker={id:SCRIPT,tag:worker.tag};
  const triggers=await get(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/builds/workers/${worker.tag}/triggers`);
  out.triggersHttpStatus=triggers.status;
  if(!triggers.ok){out.reason="build-trigger-read-not-authorized";}
  else{
    const list=triggers.body?.result??[];
    out.triggers=(Array.isArray(list)?list:[]).map(t=>({
      triggerUuid:t.trigger_uuid??null,
      triggerName:t.trigger_name??null,
      branchIncludes:t.branch_includes??[],
      branchExcludes:t.branch_excludes??[],
      buildCommand:t.build_command??null,
      deployCommand:t.deploy_command??null,
      previewBranchIncludes:t.preview_branch_includes??null,
      rootDirectory:t.root_directory??null,
      buildCachingEnabled:t.build_caching_enabled??null
    }));
    out.status="EVIDENCE_RETRIEVED";
  }
}catch(e){out.reason=out.reason??"bounded-read-failed";}
let txt=JSON.stringify(out,null,2)+"\n";
if(token&&txt.includes(token)) txt=JSON.stringify({status:"HOLD",reason:"output-secret-guard"})+"\n";
await writeFile("scheduler-s1-build-trigger.json",txt);
console.log(txt);
if(out.status!=="EVIDENCE_RETRIEVED") process.exitCode=1;
