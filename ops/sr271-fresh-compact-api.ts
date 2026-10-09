import {observeLegacyRecovery} from '../lib/reliability-legacy-manifest';
import {legacyManifestHash} from '../lib/reliability-legacy-recovery';
import {compactPreimage,reconcileCompactSafetyGate} from './sr271-compact-legacy-recovery';
import {emptyReliabilityControl,type ReliabilityControlLease} from '../lib/reliability-control-store';
type Value=string|number|null;
const root='https://api.cloudflare.com/client/v4/accounts/9c1807c68493f14259248b5f5782cc6f',database='55596003-1b90-4f66-aad8-decb21205f13',oldId='8f5b996c-b058-4864-8472-ec2836e6274a';
const parentHash='33292ff68a80d837d9b98803d37414cb90352fa1571a33e561d7bd28d8520074',operation=process.env.OPERATION??'observe',stop=Date.parse('2026-10-09T08:20:00Z');
const report=(tag:string,value:unknown)=>console.log(tag+' '+JSON.stringify(value));
let readOnly=true,maxRequestBytes=0,requests=0;
if(!['observe','commit'].includes(operation)||Date.now()>stop||Number(process.env.RUN_ATTEMPT)!==1)throw Error('Fresh compact operation expired, repeated or invalid');
async function api(body:{sql?:string;params?:Value[];batch?:Array<{sql:string;params:Value[]}>}){
 if(Date.now()>stop)throw Error('Fresh compact deadline reached; no more sends');
 const statements=body.batch??[{sql:body.sql??'',params:body.params??[]}];if(readOnly&&statements.some(s=>!s.sql.startsWith('SELECT ')))throw Error('Observation GET/SELECT only');
 const text=JSON.stringify(body),bytes=Buffer.byteLength(text);if(bytes>5000000)throw Error('Bounded recovery request exceeds5MB; not sent');maxRequestBytes=Math.max(maxRequestBytes,bytes);requests++;
 const r=await fetch(root+'/d1/database/'+database+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CF_TOKEN,'Content-Type':'application/json'},body:text,signal:AbortSignal.timeout(25000)}),p=await r.json() as {success:boolean;errors:unknown[];result:D1Result[]};
 if(!r.ok||!p.success||!p.result||p.result.some(x=>!x.success||readOnly&&(x.meta.changes||x.meta.rows_written)))throw Error('D1 unconfirmed '+r.status+' '+JSON.stringify(p.errors??[]));return p.result;
}
class Statement{
 constructor(readonly sql:string,readonly params:Value[]=[]){ }
 bind(...params:Value[]){return new Statement(this.sql,params);}
 async first<T>(column?:string){const r=(await api({sql:this.sql,params:this.params}))[0].results[0] as Record<string,unknown>|undefined;return (column?r?.[column]:r??null) as T;}
 async all<T>(){return(await api({sql:this.sql,params:this.params}))[0] as D1Result<T>;}
 async run(){return(await api({sql:this.sql,params:this.params}))[0];}
}
const db={prepare:(sql:string)=>new Statement(sql),batch:(ss:Statement[])=>api({batch:ss.map(({sql,params})=>({sql,params}))})} as unknown as D1Database;
async function cf(path:string){const r=await fetch(root+path,{headers:{Authorization:'Bearer '+process.env.CF_TOKEN},signal:AbortSignal.timeout(25000)}),p=await r.json() as {success:boolean;result:any};if(!r.ok||!p.success)throw Error('Cloudflare GET unconfirmed');return p.result;}
async function allocations(){for(const [service,version] of [['vigia-runtime',process.env.RUNTIME_VERSION],['vigia-source-runner','9ccaa456-4b52-41ce-a12a-249f9e1a9db4']]){const deployments=await cf('/workers/scripts/'+service+'/deployments'),active=deployments.deployments[0];report('R10_COMPACT_ALLOCATION',{at:new Date().toISOString(),service,active});if(operation==='commit'&&(!version||active.versions.length!==1||active.versions[0].version_id!==version||active.versions[0].percentage!==100))throw Error('Allocation changed; no compact mutation');}}
await allocations();
const prior=await db.prepare('SELECT recovery_id,manifest_hash,committed_at FROM source_reliability_recoveries WHERE old_job_id=?').bind(oldId).first();if(prior){report('R10_COMPACT_ALREADY_DONE',prior);process.exit(0);}
const beforeIntent=await db.prepare('SELECT effect_key,ordinal,manifest_json,committed_at,result_json FROM source_reliability_effects WHERE job_id=? AND ordinal IN (-1,-2)').bind(oldId).all<any>();
const parent=beforeIntent.results.find(x=>x.ordinal===-1);if(beforeIntent.results.some(x=>x.ordinal===-2)||parent?.effect_key!=='legacy-reconcile:'+oldId+':'+parentHash||parent.committed_at!==null||parent.result_json!==null)throw Error('Prior compact result must be reconciled; no repeated mutation');
report('R10_COMPACT_PRIOR',{oldId,parentKey:parent.effect_key,originalIntentUnconfirmed:true,zeroWrite:true});
const observed=await observeLegacyRecovery(db,oldId),manifest={...observed,official:{...observed.official,alerts:[]}},hash=await legacyManifestHash(manifest),payload=JSON.stringify(manifest);
const proofSizes=manifest.preimages.map((p,index)=>Buffer.byteLength(JSON.stringify({schemaVersion:1,kind:'verified-current-preimage',oldJobId:oldId,manifestHash:hash,index,...compactPreimage(p)})));
report('R10_COMPACT_FRESH_OBSERVATION',{at:new Date().toISOString(),observedAt:manifest.observedAt,hash,recordsObserved:manifest.official.recordsObserved,missing:manifest.official.missing,mismatches:manifest.official.mismatches,covered:manifest.covered,preimages:proofSizes.length,maxProofBytes:Math.max(...proofSizes),payloadBytes:Buffer.byteLength(payload),oldCursor:manifest.state.cursor,oldLastSuccess:manifest.state.last_success_at,zeroWrite:true});
if(!manifest.covered||manifest.official.missing.length||manifest.official.mismatches.length||proofSizes.some(n=>n>1900000))throw Error('Fresh complete bounded proof unconfirmed; keep quarantine');
if(operation==='observe'){report('R10_COMPACT_OBSERVER_COMPLETE',{at:new Date().toISOString(),zeroWrite:true,requests,maxRequestBytes});process.exit(0);}
const owner='sr271-fresh-compact-sg-20261009',waitUntil=Math.min(Date.now()+360000,stop-480000);let before:{owner_id:string|null;epoch:number}|null=null;
for(;;){before=await db.prepare('SELECT owner_id,epoch FROM source_reliability_control WHERE id=1').first<{owner_id:string|null;epoch:number}>();const leases=await db.prepare('SELECT source,owner_id,expires_at FROM source_sync_locks WHERE expires_at>?').bind(new Date().toISOString()).all();if(before&&before.owner_id===null&&!leases.results.length)break;report('R10_COMPACT_WAIT',{at:new Date().toISOString(),owner:before?.owner_id,activeSources:leases.results.map(x=>(x as any).source),zeroWrite:true});if(Date.now()>=waitUntil)throw Error('Active coordinator prevents compact checkpoint; no concurrent operation');await new Promise(resolve=>setTimeout(resolve,10000));}
if(Date.now()>stop-480000||Date.now()-Date.parse(manifest.observedAt)>20*60000)throw Error('Insufficient bounded recovery window; no mutation');
await allocations();
const at=new Date().toISOString(),lease:ReliabilityControlLease={ownerId:owner,epoch:before!.epoch+1,expiresAt:new Date(Date.now()+480000).toISOString(),state:emptyReliabilityControl()};readOnly=false;
try{const row=await db.prepare("UPDATE source_reliability_control SET owner_id=?,epoch=epoch+1,expires_at=? WHERE id=1 AND owner_id IS NULL AND epoch=? AND NOT EXISTS(SELECT 1 FROM source_sync_locks WHERE expires_at>?) AND EXISTS(SELECT 1 FROM source_reliability_jobs WHERE id=? AND receipt_json IS NULL AND finished_at IS NULL) RETURNING epoch").bind(owner,lease.expiresAt,before!.epoch,at,oldId).first<{epoch:number}>();if(row?.epoch!==lease.epoch)throw Error('Compact owner CAS not acquired');}
catch(error){const current=await db.prepare('SELECT owner_id,epoch FROM source_reliability_control WHERE id=1').first<{owner_id:string|null;epoch:number}>();if(current?.owner_id!==owner||current.epoch!==lease.epoch)throw error;}
let completed=false;
try{
 const namespace='snapshot:'+oldId+':'+hash,parts=[];for(let offset=0;offset<payload.length;offset+=50000)parts.push(payload.slice(offset,offset+50000));
 const fence=()=>db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM source_reliability_control WHERE id=1 AND owner_id=? AND epoch=? AND expires_at>?) THEN 1 ELSE json('fresh-plan-fence-lost') END").bind(owner,lease.epoch,new Date().toISOString());
 for(let offset=0;offset<parts.length;offset+=20){const chunk=parts.slice(offset,offset+20);try{await db.batch([fence(),...chunk.map((part,index)=>db.prepare('INSERT INTO source_reliability_recovery_plans(old_job_id,part,manifest_hash,payload) VALUES(?,?,?,?)').bind(namespace,offset+index,hash,part))]);}
 catch(error){const found=await db.prepare('SELECT part,manifest_hash,payload FROM source_reliability_recovery_plans WHERE old_job_id=? AND part>=? AND part<? ORDER BY part').bind(namespace,offset,offset+chunk.length).all<any>();if(found.results.length!==chunk.length||found.results.some((p,i)=>p.part!==offset+i||p.manifest_hash!==hash||p.payload!==chunk[i]))throw error;}}
 report('R10_COMPACT_MANIFEST_STAGED',{at:new Date().toISOString(),namespace,hash,parts:parts.length,originalManifestUnchanged:true,lease});
 completed=await reconcileCompactSafetyGate(db,manifest,hash,lease,new Date().toISOString(),report,parentHash);
}catch(error){report('R10_COMPACT_HOLD',{at:new Date().toISOString(),reason:error instanceof Error?error.message:'Unknown',lease,noReplay:true});throw error;}
finally{try{await db.prepare('UPDATE source_reliability_control SET owner_id=NULL,expires_at=NULL WHERE id=1 AND owner_id=? AND epoch=?').bind(owner,lease.epoch).run();}catch{const row=await db.prepare('SELECT owner_id,epoch FROM source_reliability_control WHERE id=1').first<{owner_id:string|null;epoch:number}>();if(row?.owner_id===owner)throw Error('Compact owner release unconfirmed; no retry');}}
readOnly=true;
const recovery=await db.prepare('SELECT old_job_id,recovery_id,manifest_hash,committed_at,receipt_json FROM source_reliability_recoveries WHERE old_job_id=?').bind(oldId).first(),pending=await db.prepare('SELECT effect_key,ordinal FROM source_reliability_effects WHERE job_id=? AND committed_at IS NULL').bind(oldId).all();
report('R10_COMPACT_COMPLETE',{at:new Date().toISOString(),completed,recovery,pending:pending.results,requests,maxRequestBytes,noDomainReplay:true});if(!completed||!recovery||pending.results.length)throw Error('Compact postflight unproved');
