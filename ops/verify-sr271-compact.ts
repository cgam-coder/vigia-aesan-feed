import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {initializeReliabilityJobs} from '../lib/reliability-job-store';
import {createReliabilityControlStore,emptyReliabilityControl} from '../lib/reliability-control-store';
import {legacyManifestHash} from '../lib/reliability-legacy-recovery';
import type {LegacyRecoveryManifest} from '../lib/reliability-legacy-manifest';
import {reconcileCompactSafetyGate} from './sr271-compact-legacy-recovery';
type Value=string|number|null;
class Statement{
 constructor(readonly db:DatabaseSync,readonly sql:string,readonly params:Value[]=[]){ }
 bind(...params:Value[]){return new Statement(this.db,this.sql,params);}
 async first<T>(column?:string){const row=this.db.prepare(this.sql).get(...this.params) as Record<string,unknown>|undefined;return (column?row?.[column]:row) as T??null;}
 async all<T>(){return{results:this.db.prepare(this.sql).all(...this.params) as T[],success:true,meta:{}};}
 execute(){if(/^\s*(SELECT|PRAGMA)\b/iu.test(this.sql)||/\bRETURNING\b/iu.test(this.sql))return{results:this.db.prepare(this.sql).all(...this.params),success:true,meta:{changes:Number(this.db.prepare('SELECT changes() AS n').get()?.n??0)}};const r=this.db.prepare(this.sql).run(...this.params);return{results:[],success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
 async run(){return this.execute();}async raw(){return[];}
}
class LocalD1{
 constructor(readonly db:DatabaseSync){}
 prepare(sql:string){return new Statement(this.db,sql);}
 async batch(statements:Statement[]){this.db.exec('BEGIN IMMEDIATE');try{const r=statements.map(s=>s.execute());this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}

const id='8f5b996c-b058-4864-8472-ec2836e6274a',at='2026-10-09T06:29:00.000Z',expiry='2026-10-09T06:37:00.000Z';
async function fixture(run:(context:any)=>Promise<void>){const db=new DatabaseSync(':memory:');try{
 db.exec(readFileSync(new URL('./sr271-compact-verify-schema.sql',import.meta.url),'utf8'));
 const base=new LocalD1(db);await initializeReliabilityJobs(base as unknown as D1Database);
 db.prepare("INSERT INTO source_reliability_jobs(id,source,mode,kind,epoch,started_at,deadline) VALUES(?,'SAFETY GATE','recent','recent',2,'2026-10-08T13:41:40.702Z',1791467259973)").run(id);
 db.prepare("INSERT INTO source_sync_state(source,mode,status,cursor,total_units,started_at,last_success_at,lease_owner_id,lease_mode,lease_expires_at,updated_at) VALUES('SAFETY GATE','recent','running',0,0,'2026-10-08T13:41:41.989Z','2026-10-08T07:19:34.681Z',?,'recent','2026-10-08T13:51:42.374Z','2026-10-08T13:43:42.374Z')").run(id);
 db.prepare("INSERT INTO source_checks(source,status,error) VALUES('SAFETY GATE','error',?)").run('x'.repeat(1200000));
 const control=createReliabilityControlStore(base as unknown as D1Database);await control.acquire('original-recovery',Date.parse(at),at,expiry);db.prepare('UPDATE source_reliability_control SET owner_id=NULL,expires_at=NULL,epoch=194').run();
 const lease=await control.acquire('compact-recovery',Date.parse(at)+1,at,expiry);assert.ok(lease);assert.equal(lease.epoch,195);
 lease.state={...emptyReliabilityControl(),ownershipVerifiedAt:at,attempts:{'SAFETY GATE':{id,startedAt:'2026-10-08T13:41:39.973Z',outcome:'running',nextEligibleAt:null,failures:0,reason:null}}};await control.save(lease,lease.state,at);
 const read=(sql:string,params:Value[])=>({sql,params,rows:db.prepare(sql).all(...params) as LegacyRecoveryManifest['preimages'][number]['rows']});
 const p=[read('SELECT * FROM source_reliability_jobs WHERE id=?',[id]),read('SELECT * FROM source_sync_state WHERE source=? AND mode=?',['SAFETY GATE','recent']),read('SELECT * FROM source_checks WHERE source=? ORDER BY id',['SAFETY GATE']),read('SELECT * FROM alerts WHERE source=? ORDER BY id',['SAFETY GATE'])];
 const manifest:LegacyRecoveryManifest={schemaVersion:1,oldJobId:id,observedAt:at,job:p[0].rows[0],state:p[1].rows[0],locks:[],checks:[],certificate:null,official:{recordsObserved:1,alerts:[],missing:[],mismatches:[]},preimages:p,covered:true,reason:null},hash=await legacyManifestHash(manifest),parent='legacy-reconcile:'+id+':'+hash;
 db.prepare("INSERT INTO source_reliability_effects(effect_key,job_id,source,mode,ordinal,manifest_json) VALUES(?,?,'SAFETY GATE','recent',-1,?)").run(parent,id,JSON.stringify({schemaVersion:1,oldJobId:id,manifestHash:hash,originalJob:manifest.job,originalState:manifest.state}));
 await run({db,base,lease,manifest,hash,parent});
 }finally{db.close();}}
test('compact CAS preserves domain rows, cursor and last success; original epoch is fenced and intent closure names its replacement',()=>fixture(async({db,base,lease,manifest,hash,parent})=>{
 assert.throws(()=>db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM source_reliability_control WHERE id=1 AND epoch=194) THEN 1 ELSE json('original-fenced') END").get(),/JSON/);
 assert.equal(await reconcileCompactSafetyGate(base as unknown as D1Database,manifest,hash,lease,at),true);
 const s=db.prepare("SELECT * FROM source_sync_state WHERE source='SAFETY GATE'").get();assert.equal(s.cursor,0);assert.equal(s.last_success_at,'2026-10-08T07:19:34.681Z');assert.equal(s.status,'partial');assert.equal(s.lease_owner_id,null);
 assert.equal(db.prepare('SELECT LENGTH(error) AS n FROM source_checks').get().n,1200000);
 const closure=JSON.parse(db.prepare('SELECT result_json FROM source_reliability_effects WHERE effect_key=?').get(parent).result_json);assert.equal(closure.originalTransactionResult,'unconfirmed-and-fenced');assert.equal(closure.replacementCoordinatorEpoch,195);
 const r=JSON.parse(db.prepare('SELECT receipt_json FROM source_reliability_recoveries').get().receipt_json);assert.equal(r.outcome,'partial');assert.equal(r.reconciliation.originalTransportResult,'unknown');assert.equal(r.reconciliation.originalReceipt,null);
 assert.equal(await reconcileCompactSafetyGate(base as unknown as D1Database,manifest,hash,lease,at),true);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM source_reliability_recoveries').get().n,1);
}));
test('compact final commit lost response is resolved by marker and never executed twice',()=>fixture(async({db,base,lease,manifest,hash})=>{
 const original=base.batch.bind(base);let finals=0;const bytes=[];base.batch=async statements=>{bytes.push(Buffer.byteLength(JSON.stringify(statements.map(s=>({sql:s.sql,params:s.params})))));const r=await original(statements);if(statements.some(s=>s.sql.includes('INSERT INTO source_reliability_recoveries'))){finals++;throw Error('lost response');}return r;};
 assert.equal(await reconcileCompactSafetyGate(base as unknown as D1Database,manifest,hash,lease,at),true);assert.equal(finals,1);assert.ok(bytes.at(-1)<20000);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM source_reliability_recoveries').get().n,1);
 assert.equal(await reconcileCompactSafetyGate(base as unknown as D1Database,manifest,hash,lease,at),true);assert.equal(finals,1);
}));
test('uncertain compact attempt cannot be resent; parent and source remain quarantined',()=>fixture(async({db,base,lease,manifest,hash,parent})=>{
 const original=base.batch.bind(base);let finals=0;base.batch=async statements=>{if(statements.some(s=>s.sql.includes('INSERT INTO source_reliability_recoveries'))){finals++;throw Error('remote result unknown');}return original(statements);};
 await assert.rejects(reconcileCompactSafetyGate(base as unknown as D1Database,manifest,hash,lease,at));assert.equal(finals,1);
 await assert.rejects(reconcileCompactSafetyGate(base as unknown as D1Database,manifest,hash,lease,at),/Compact intent already exists/);assert.equal(finals,1);
 assert.equal(db.prepare('SELECT committed_at FROM source_reliability_effects WHERE effect_key=?').get(parent).committed_at,null);assert.equal(db.prepare('SELECT receipt_json FROM source_reliability_jobs WHERE id=?').get(id).receipt_json,null);
}));
test('changed source preimage after compact planning rolls back every metadata effect',()=>fixture(async({db,base,lease,manifest,hash,parent})=>{
 const original=base.batch.bind(base);base.batch=async statements=>{const r=await original(statements);if(statements.some(s=>s.sql.includes('INSERT INTO source_reliability_effects')&&s.params.includes('legacy-reconcile-compact:'+id+':'+hash)))db.prepare("UPDATE source_sync_state SET cursor=1 WHERE source='SAFETY GATE'").run();return r;};
 await assert.rejects(reconcileCompactSafetyGate(base as unknown as D1Database,manifest,hash,lease,at));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM source_reliability_recoveries').get().n,0);assert.equal(db.prepare('SELECT receipt_json FROM source_reliability_jobs WHERE id=?').get(id).receipt_json,null);assert.equal(db.prepare('SELECT committed_at FROM source_reliability_effects WHERE effect_key=?').get(parent).committed_at,null);
}));
