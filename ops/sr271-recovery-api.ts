import {createD1AlertStore} from '../lib/persistence/d1-alert-store';
import {createDurableJobDatabase} from '../lib/reliability-durable-effects';
import {observeLegacyRecovery,type LegacyRecoveryManifest} from '../lib/reliability-legacy-manifest';
import {legacyManifestHash,reconcileLegacyEffects} from '../lib/reliability-legacy-recovery';
import {safetyGateOfficiallyEquivalent} from '../lib/safety-gate-published';
import {emptyReliabilityControl,type ReliabilityControlLease} from '../lib/reliability-control-store';
import type {ReliabilitySourceJob,ReliabilitySourceReceipt} from '../lib/reliability-source-runner';

type Value=string|number|null;
const root='https://api.cloudflare.com/client/v4/accounts/9c1807c68493f14259248b5f5782cc6f',database='55596003-1b90-4f66-aad8-decb21205f13';
const report=(tag:string,value:unknown)=>console.log(tag+' '+JSON.stringify(value));
async function api(body:unknown){const response=await fetch(root+'/d1/database/'+database+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CF_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)}),p=await response.json() as {success:boolean;result:D1Result[]};if(!response.ok||!p.success||!p.result||p.result.some(x=>!x.success))throw Error('D1 API transaction result unconfirmed');return p.result;}
class Statement{
 constructor(readonly sql:string,readonly params:Value[]=[]){ }
 bind(...params:Value[]){return new Statement(this.sql,params);}
 async first<T>(column?:string){const r=(await api({sql:this.sql,params:this.params}))[0].results[0] as Record<string,unknown>|undefined;return (column?r?.[column]:r??null) as T;}
 async all<T>(){return (await api({sql:this.sql,params:this.params}))[0] as D1Result<T>;}
 async run(){return(await api({sql:this.sql,params:this.params}))[0];}
}
const db={prepare:(sql:string)=>new Statement(sql),batch:(statements:Statement[])=>api({batch:statements.map(({sql,params})=>({sql,params}))})} as unknown as D1Database;
globalThis.__VIGIA_DB__=db;
async function cf(path:string){const r=await fetch(root+path,{headers:{Authorization:'Bearer '+process.env.CF_TOKEN},signal:AbortSignal.timeout(25000)}),p=await r.json() as {success:boolean;result:Record<string,unknown>};if(!r.ok||!p.success)throw Error('Cloudflare GET unconfirmed');return p.result;}
async function allocation(){for(const [service,version] of [['vigia-runtime','c10ed4a7-85a0-4eeb-af8f-a122256e2862'],['vigia-source-runner','c3092b8f-e233-4f43-9d5b-0c57b3a512d3']]){const r=await cf('/workers/scripts/'+service+'/deployments') as {deployments:Array<{id:string;versions:Array<{version_id:string;percentage:number}>}>};const active=r.deployments[0];report('R9_PREFLIGHT_ALLOCATION',{at:new Date().toISOString(),service,active});if(active.versions.length!==1||active.versions[0].version_id!==version||active.versions[0].percentage!==100)throw Error('Allocation changed; no mutation authorized');}}
const mode=process.env.RECOVERY_PHASE;
if(Date.now()>Date.parse('2026-10-09T06:25:00Z')||Number(process.env.RUN_ATTEMPT)!==1)throw Error('Operational checkpoint expired or duplicate execution');
await allocation();

if(mode==='schema'){
 const tables=await db.prepare("SELECT name,sql FROM sqlite_master WHERE name IN ('source_reliability_effects','source_reliability_recovery_plans','source_reliability_recoveries')").all<{name:string;sql:string}>();
 const ledger=await db.prepare('SELECT name FROM d1_migrations ORDER BY id').all<{name:string}>();report('R9_SCHEMA_BEFORE',{tables:tables.results,ledger:ledger.results});
 if(tables.results.length||ledger.results.length!==14||ledger.results[13].name!=='0013_chubby_morph.sql')throw Error('Schema state differs; inspect before any write');
 const control=await db.prepare('SELECT owner_id,expires_at,epoch FROM source_reliability_control WHERE id=1').first<{owner_id:string|null;expires_at:string|null;epoch:number}>();if(!control||control.owner_id)throw Error('Coordinator active; schema checkpoint HOLD');
 const ddl=process.env.SCHEMA_SQL as string|undefined;if(!ddl)throw Error('Missing immutable schema');
 const sqls=ddl.split(';').map(x=>x.trim()).filter(Boolean);
 const guard=db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM source_reliability_control WHERE id=1 AND owner_id IS NULL AND epoch=?) AND (SELECT COUNT(*) FROM d1_migrations)=14 THEN 1 ELSE json('schema-preflight-changed') END").bind(control.epoch);
 try{await db.batch([guard,...sqls.map(sql=>db.prepare(sql)),db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind('ops/sr271-durable-effects-v1.sql')]);}
 catch{report('R9_SCHEMA_TRANSPORT','Result unknown; SELECT verification only follows, no retry');}
 const after=await db.prepare("SELECT name,sql FROM sqlite_master WHERE name IN ('source_reliability_effects','source_reliability_recovery_plans','source_reliability_recoveries') ORDER BY name").all();const migrated=await db.prepare("SELECT name FROM d1_migrations WHERE name='ops/sr271-durable-effects-v1.sql'").first();report('R9_SCHEMA_AFTER',{tables:after.results,migrated});if(after.results.length!==3||!migrated)throw Error('Schema outcome HOLD; do not repeat');
 // Verify REST batch rollback before relying on it for any domain effect.
 const key='sr271-rest-atomic-probe-20261009';
 if(await db.prepare('SELECT effect_key FROM source_reliability_effects WHERE effect_key=?').bind(key).first())throw Error('Atomic probe already present; inspect');
 let rejected=false;try{await db.batch([db.prepare("INSERT INTO source_reliability_effects(effect_key,job_id,source,mode,ordinal,manifest_json) VALUES(?,?,'CONTROL','atomic-probe',0,'{}')").bind(key,key),db.prepare("SELECT json('expected-atomic-probe-abort')")]);}catch{rejected=true;}
 const probe=await db.prepare('SELECT effect_key FROM source_reliability_effects WHERE effect_key=?').bind(key).first();report('R9_REST_ATOMICITY',{rejected,markerAbsent:probe===null});if(!rejected||probe)throw Error('REST batch did not prove atomic rollback; HOLD before domain effects');
}else if(mode==='effects'){
 const oldId='8f5b996c-b058-4864-8472-ec2836e6274a';
 const manifest=await observeLegacyRecovery(db,oldId),hash=await legacyManifestHash(manifest);
 const rows=(table:string)=>{const map=new Map<string,LegacyRecoveryManifest['job']>();for(const p of manifest.preimages)if(p.sql.startsWith('SELECT * FROM '+table+' '))for(const r of p.rows)map.set(String(r.id??r.alert_id),r);return [...map.values()];};
 const current=rows('alerts'),versions=rows('alert_versions'),targets=[];
 if(manifest.official.mismatches.some(x=>!x.endsWith(':current-effect-equivalence-unproved')))throw Error('Unproved auxiliary or identity effects remain; HOLD');
 for(const a of manifest.official.alerts){const r=current.find(x=>x.id===a.id||x.reference===a.reference);if(!r){if(['alert_source_identities','alert_aliases','alert_versions','alert_dimension_state','alert_categories','alert_hazards','alert_geographies','alert_actors'].some(table=>rows(table).some(x=>x.alert_id===a.id)))throw Error('Orphan effects');targets.push(a);continue;}if(r.content_hash===a.contentHash)continue;
 const v=versions.filter(x=>x.alert_id===r.id),c=JSON.parse(String(r.canonical_json));if(Number(r.version_count)!==v.length||c.identity.internalId!==r.id||c.identity.officialReference!==r.reference||!v.some(x=>safetyGateOfficiallyEquivalent(c,JSON.parse(String(x.snapshot)).canonical)))throw Error('Unattributed stored material');targets.push(a);}
 report('R9_REPAIR_PLAN',{at:manifest.observedAt,hash,targets:targets.map(a=>({reference:a.reference,contentHash:a.contentHash})),originalJob:manifest.job,originalState:manifest.state});
 if(!targets.length)throw Error('No distinct absent effects; do not create a redundant repair');
 const at=new Date().toISOString(),owner=process.env.RECOVERY_OWNER,id=process.env.REPAIR_JOB_ID;if(!owner||!id)throw Error('Missing immutable recovery identity');
 const before=await db.prepare('SELECT owner_id,expires_at,epoch FROM source_reliability_control WHERE id=1').first<{owner_id:string|null;expires_at:string|null;epoch:number}>();if(!before||before.owner_id)throw Error('Coordinator active; no concurrent recovery');
 const job:ReliabilitySourceJob={id,source:'SAFETY GATE',mode:'recent',kind:'recent',epoch:before.epoch+1,deadline:Date.now()+360000,coordinatorOwner:owner,beforeUpdatedAt:String(manifest.state.updated_at)};
 const lease:ReliabilityControlLease={ownerId:owner,epoch:job.epoch,expiresAt:new Date(Date.now()+600000).toISOString(),state:emptyReliabilityControl()};
 const guard=(sql:string,params:Value[],expectedRows:LegacyRecoveryManifest['job'][])=>{const names=Object.keys(expectedRows[0]??{});if(!names.length)return db.prepare(`SELECT CASE WHEN NOT EXISTS(${sql}) THEN 1 ELSE json('repair-absence-CAS-lost') END`).bind(...params);const arrays=[];for(let i=0;i<names.length;i+=16)arrays.push('json_array('+names.slice(i,i+16).map(k=>'"'+k+'"').join(',')+')');const expected=JSON.stringify(expectedRows.map(r=>{const p=[];for(let i=0;i<names.length;i+=16)p.push(names.slice(i,i+16).map(k=>r[k]));return p;}));return db.prepare(`SELECT CASE WHEN (SELECT json_group_array(json_array(${arrays.join(',')})) FROM (${sql})) IS ? THEN 1 ELSE json('repair-preimage-CAS-lost') END`).bind(...params,expected);};
 const guards=manifest.preimages.filter(p=>p.sql.startsWith('SELECT * FROM source_')).map(p=>guard(p.sql,p.params,p.rows));
 for(let offset=0;offset<targets.length;offset+=20){const chunk=targets.slice(offset,offset+20),ids=chunk.map(a=>a.id),q=ids.map(()=>'?').join(',');
 const query='SELECT * FROM alerts WHERE source=? AND (id IN ('+q+') OR reference IN ('+q+')) ORDER BY id',selected=current.filter(r=>ids.includes(String(r.id))||chunk.some(a=>a.reference===r.reference)).sort((a,b)=>String(a.id).localeCompare(String(b.id)));guards.push(guard(query,['SAFETY GATE',...ids,...chunk.map(a=>a.reference)],selected));
 for(const table of ['alert_source_identities','alert_versions','alert_aliases','alert_dimension_state','alert_categories','alert_hazards','alert_geographies','alert_actors']){const order=table==='alert_source_identities'||table==='alert_dimension_state'?'alert_id':'id',selected=rows(table).filter(r=>ids.includes(String(r.alert_id))).sort((a,b)=>typeof a[order]==='number'?Number(a[order])-Number(b[order]):String(a[order]).localeCompare(String(b[order])));guards.push(guard('SELECT * FROM '+table+' WHERE alert_id IN ('+q+') ORDER BY '+order,ids,selected));}}
 const path='$.attempts."SAFETY GATE".id';guards.unshift(db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM source_reliability_control WHERE id=1 AND owner_id IS NULL AND epoch=? AND json_extract(state_json,?)=?) AND NOT EXISTS(SELECT 1 FROM source_reliability_jobs WHERE id=?) THEN 1 ELSE json('repair-coordinator-changed') END").bind(before.epoch,path,oldId,id));
 await db.batch([...guards,db.prepare('UPDATE source_reliability_control SET owner_id=?,epoch=epoch+1,expires_at=? WHERE id=1 AND owner_id IS NULL AND epoch=?').bind(owner,lease.expiresAt,before.epoch),db.prepare("INSERT INTO source_reliability_jobs(id,source,mode,kind,epoch,started_at,deadline,phase) VALUES(?,'SAFETY GATE','recent','recent',?,?,?,'reading')").bind(id,job.epoch,at,job.deadline),db.prepare("INSERT INTO source_sync_locks(source,owner_id,mode,acquired_at,heartbeat_at,expires_at) VALUES('SAFETY GATE',?,'recent',?,?,?) ON CONFLICT(source) DO UPDATE SET owner_id=excluded.owner_id,mode=excluded.mode,acquired_at=excluded.acquired_at,heartbeat_at=excluded.heartbeat_at,expires_at=excluded.expires_at WHERE source_sync_locks.expires_at<=excluded.acquired_at").bind(id,at,at,new Date(Date.now()+480000).toISOString())]);
 const store=createD1AlertStore(createDurableJobDatabase(db,job)),result=await store.persistSuccess('SAFETY GATE',targets,{ownerId:id,now:()=>new Date().toISOString()});report('R9_DISTINCT_EFFECTS',result);
 const markers=await db.prepare('SELECT ordinal,committed_at,LENGTH(CAST(manifest_json AS BLOB)) AS bytes FROM source_reliability_effects WHERE job_id=? ORDER BY ordinal').bind(id).all<{ordinal:number;committed_at:string|null;bytes:number}>();if(!markers.results.length||markers.results.some(x=>!x.committed_at))throw Error('Unconfirmed effect marker; keep quarantine');
 const state=await createD1AlertStore(db).readSyncState!('SAFETY GATE','recent'),finishedAt=new Date().toISOString();
 const receipt:ReliabilitySourceReceipt={id,source:'SAFETY GATE',mode:'recent',kind:'recent',startedAt:at,finishedAt,outcome:'partial',state,requests:0,batches:1,reason:'distinct-current-official-effects-repaired-original-result-still-unknown'};
 const key='legacy-repair:'+hash,description=JSON.stringify({schemaVersion:1,oldJobId:oldId,jobId:id,inputManifestHash:hash,targets:targets.map(a=>({id:a.id,reference:a.reference,contentHash:a.contentHash})),originalJob:manifest.job,originalState:manifest.state,originalTransportResult:'unknown'}),text=JSON.stringify(receipt);
 try{await db.batch([db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM source_reliability_control WHERE id=1 AND owner_id=? AND epoch=? AND expires_at>?) AND EXISTS(SELECT 1 FROM source_sync_locks WHERE source='SAFETY GATE' AND owner_id=? AND expires_at>?) THEN 1 ELSE json('repair-receipt-fence-lost') END").bind(owner,job.epoch,finishedAt,id,finishedAt),db.prepare('INSERT INTO source_reliability_effects(effect_key,job_id,source,mode,ordinal,manifest_json,committed_at,result_json) VALUES(?,?,?, ?,999999,?,?,?)').bind(key,id,job.source,job.mode,description,finishedAt,text),db.prepare("UPDATE source_reliability_jobs SET phase='finished',finished_at=?,receipt_json=? WHERE id=? AND receipt_json IS NULL").bind(finishedAt,text,id)]);}catch{const committed=await db.prepare('SELECT result_json FROM source_reliability_effects WHERE effect_key=?').bind(key).first<{result_json:string}>();if(committed?.result_json!==text)throw Error('Repair receipt ambiguous; no replay');}
 await db.batch([db.prepare("DELETE FROM source_sync_locks WHERE source='SAFETY GATE' AND owner_id=?").bind(id),db.prepare('UPDATE source_reliability_control SET owner_id=NULL,expires_at=NULL WHERE id=1 AND owner_id=? AND epoch=?').bind(owner,job.epoch)]);
 report('R9_REPAIR_COMMITTED',{id,key,receipt,markers:markers.results.length,allCommitted:true,originalQuarantinePreserved:true});
}else if(mode==='legacy'){
 throw Error('Legacy reconciliation must use a separately refreshed approved manifest checkpoint');
}else throw Error('Unknown recovery phase');
