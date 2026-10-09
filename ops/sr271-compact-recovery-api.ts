import {reconcileCompactSafetyGate} from './sr271-compact-legacy-recovery';
import type {LegacyRecoveryManifest} from '../lib/reliability-legacy-manifest';
import {emptyReliabilityControl,type ReliabilityControlLease} from '../lib/reliability-control-store';
type Value=string|number|null;
const root='https://api.cloudflare.com/client/v4/accounts/9c1807c68493f14259248b5f5782cc6f',database='55596003-1b90-4f66-aad8-decb21205f13',oldId='8f5b996c-b058-4864-8472-ec2836e6274a',hash='33292ff68a80d837d9b98803d37414cb90352fa1571a33e561d7bd28d8520074';
const report=(tag:string,value:unknown)=>console.log(tag+' '+JSON.stringify(value));
let maxRequestBytes=0,requests=0;
async function api(body:unknown){const text=JSON.stringify(body),bytes=Buffer.byteLength(text);if(bytes>5000000)throw Error('Bounded recovery request exceeds 5 MB; not sent');maxRequestBytes=Math.max(maxRequestBytes,bytes);requests++;const r=await fetch(root+'/d1/database/'+database+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CF_TOKEN,'Content-Type':'application/json'},body:text,signal:AbortSignal.timeout(25000)}),p=await r.json() as {success:boolean;errors:unknown[];result:D1Result[]};if(!r.ok||!p.success||!p.result||p.result.some(x=>!x.success))throw Error('D1 unconfirmed '+r.status+' '+JSON.stringify(p.errors??[]));return p.result;}
class Statement{
 constructor(readonly sql:string,readonly params:Value[]=[]){ }
 bind(...params:Value[]){return new Statement(this.sql,params);}
 async first<T>(column?:string){const r=(await api({sql:this.sql,params:this.params}))[0].results[0] as Record<string,unknown>|undefined;return (column?r?.[column]:r??null) as T;}
 async all<T>(){return(await api({sql:this.sql,params:this.params}))[0] as D1Result<T>;}
 async run(){return(await api({sql:this.sql,params:this.params}))[0];}
}
const db={prepare:(sql:string)=>new Statement(sql),batch:(ss:Statement[])=>api({batch:ss.map(({sql,params})=>({sql,params}))})} as unknown as D1Database;
async function cf(path:string){const r=await fetch(root+path,{headers:{Authorization:'Bearer '+process.env.CF_TOKEN},signal:AbortSignal.timeout(25000)}),p=await r.json() as {success:boolean;result:Record<string,unknown>};if(!r.ok||!p.success)throw Error('Cloudflare GET unconfirmed');return p.result;}
if(Date.now()>Date.parse('2026-10-09T06:38:00Z')||Number(process.env.RUN_ATTEMPT)!==1)throw Error('Compact checkpoint expired or repeated');
for(const [service,version] of [['vigia-runtime','787f7769-5079-4b83-ae4c-17b96efa5364'],['vigia-source-runner','9ccaa456-4b52-41ce-a12a-249f9e1a9db4']]){const r=await cf('/workers/scripts/'+service+'/deployments') as {deployments:Array<{versions:Array<{version_id:string;percentage:number}>}>};const active=r.deployments[0];report('R9_COMPACT_ALLOCATION',{at:new Date().toISOString(),service,active});if(active.versions.length!==1||active.versions[0].version_id!==version||active.versions[0].percentage!==100)throw Error('Allocation changed; no compact mutation');}
const prior=await db.prepare('SELECT recovery_id,manifest_hash,committed_at FROM source_reliability_recoveries WHERE old_job_id=?').bind(oldId).first();if(prior){report('R9_COMPACT_ALREADY_DONE',prior);process.exit(0);}
const parts:Array<{part:number;manifest_hash:string;payload:string}>=[];
for(let offset=0;offset<600;offset+=75){const r=await db.prepare('SELECT part,manifest_hash,payload FROM source_reliability_recovery_plans WHERE old_job_id=? ORDER BY part LIMIT 75 OFFSET ?').bind(oldId,offset).all<{part:number;manifest_hash:string;payload:string}>();parts.push(...r.results);if(r.results.length<75)break;}
if(parts.length!==596||parts.some((x,i)=>x.part!==i||x.manifest_hash!==hash))throw Error('Immutable compact input differs');
const manifest=JSON.parse(parts.map(x=>x.payload).join('')) as LegacyRecoveryManifest;
const owner='sr271-compact-sg-20261009',waitUntil=Math.min(Date.now()+180000,Date.parse('2026-10-09T06:38:00Z'));
let before:{owner_id:string|null;epoch:number}|null=null;
for(;;){before=await db.prepare('SELECT owner_id,epoch FROM source_reliability_control WHERE id=1').first<{owner_id:string|null;epoch:number}>();const leases=await db.prepare('SELECT source,owner_id,expires_at FROM source_sync_locks WHERE expires_at>?').bind(new Date().toISOString()).all();if(before&&before.owner_id===null&&!leases.results.length)break;report('R9_COMPACT_WAIT',{at:new Date().toISOString(),owner:before?.owner_id,activeSources:leases.results.map(x=>(x as {source:string}).source),zeroWrite:true});if(Date.now()>=waitUntil)throw Error('Active coordinator prevents compact checkpoint; no concurrent operation');await new Promise(resolve=>setTimeout(resolve,10000));}
const at=new Date().toISOString(),lease:ReliabilityControlLease={ownerId:owner,epoch:before!.epoch+1,expiresAt:new Date(Date.now()+480000).toISOString(),state:emptyReliabilityControl()};
try{const row=await db.prepare("UPDATE source_reliability_control SET owner_id=?,epoch=epoch+1,expires_at=? WHERE id=1 AND owner_id IS NULL AND epoch=? AND NOT EXISTS(SELECT 1 FROM source_sync_locks WHERE expires_at>?) AND EXISTS(SELECT 1 FROM source_reliability_jobs WHERE id=? AND receipt_json IS NULL AND finished_at IS NULL) RETURNING epoch").bind(owner,lease.expiresAt,before!.epoch,at,oldId).first<{epoch:number}>();if(row?.epoch!==lease.epoch)throw Error('Compact owner CAS not acquired');}
catch(error){const current=await db.prepare('SELECT owner_id,epoch FROM source_reliability_control WHERE id=1').first<{owner_id:string|null;epoch:number}>();if(current?.owner_id!==owner||current.epoch!==lease.epoch)throw error;}
let completed=false;
try{completed=await reconcileCompactSafetyGate(db,manifest,hash,lease,new Date().toISOString(),report);}
catch(error){report('R9_COMPACT_HOLD',{at:new Date().toISOString(),reason:error instanceof Error?error.message:'Unknown',lease,noReplay:true});throw error;}
finally{
 try{await db.prepare('UPDATE source_reliability_control SET owner_id=NULL,expires_at=NULL WHERE id=1 AND owner_id=? AND epoch=?').bind(owner,lease.epoch).run();}
 catch{const row=await db.prepare('SELECT owner_id,epoch FROM source_reliability_control WHERE id=1').first<{owner_id:string|null;epoch:number}>();if(row?.owner_id===owner)throw Error('Compact owner release unconfirmed; no retry');}
}
const recovery=await db.prepare('SELECT old_job_id,recovery_id,manifest_hash,committed_at FROM source_reliability_recoveries WHERE old_job_id=?').bind(oldId).first(),pending=await db.prepare('SELECT effect_key,ordinal FROM source_reliability_effects WHERE job_id=? AND committed_at IS NULL').bind(oldId).all();
report('R9_COMPACT_COMPLETE',{at:new Date().toISOString(),completed,recovery,pending:pending.results,requests,maxRequestBytes,noDomainReplay:true,naturalCoordinatorResumed:true});if(!completed||!recovery||pending.results.length)throw Error('Compact postflight unproved');
