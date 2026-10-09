import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {rearmReviewedAesanFailure} from './sr271-reviewed-failure-rearm.mjs';
const at='2026-10-09T09:30:00Z',id='7eca0f35-ab72-417e-947e-3a0cd9add999',lease={owner:'review-606',epoch:230};
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(`CREATE TABLE source_reliability_control(id INTEGER PRIMARY KEY,owner_id TEXT,epoch INTEGER,expires_at TEXT,state_json TEXT);CREATE TABLE source_reliability_jobs(id TEXT PRIMARY KEY,source TEXT,mode TEXT,phase TEXT,finished_at TEXT,receipt_json TEXT);CREATE TABLE source_sync_state(source TEXT,mode TEXT,status TEXT,lease_owner_id TEXT,updated_at TEXT,last_error TEXT,PRIMARY KEY(source,mode));CREATE TABLE source_sync_locks(source TEXT);CREATE TABLE source_reliability_recoveries(old_job_id TEXT PRIMARY KEY,recovery_id TEXT UNIQUE,manifest_hash TEXT,original_job_json TEXT,original_state_json TEXT,receipt_json TEXT,committed_at TEXT);CREATE TABLE source_reliability_effects(effect_key TEXT PRIMARY KEY,job_id TEXT,source TEXT,mode TEXT,ordinal INTEGER,manifest_json TEXT,committed_at TEXT,result_json TEXT,UNIQUE(job_id,ordinal));`);
 const reason='AESAN_NATIVE taxonomy membership requires review '+JSON.stringify({gaps:[],unknown:[{reference:'ES2026/606',urls:['https://www.aesan.gob.es/alertas/2026_71']},{reference:'ES2026/382',urls:['https://www.aesan.gob.es/alertas/2026_52_Ampliacion_1']}],disappeared:[]});
 const receipt={id,source:'AESAN',mode:'recent',outcome:'failed',reason,state:{recordsPersisted:0,updatedAt:'2026-10-09T09:00:32.390Z',lastError:reason}};
 const control={attempts:{AESAN:{id,outcome:'failed',nextEligibleAt:'9999-01-01T00:00:00.000Z',failures:1,reason:'known-source-error'}},revisionAttempts:{'RASFF:reconcile':{id:'historical',outcome:'partial'}},lastAudit:{allFresh:false},lastSelection:'RASFF'};
 sqlite.prepare('INSERT INTO source_reliability_control VALUES(1,?,?,?,?)').run(lease.owner,lease.epoch,'2026-10-09T09:40:00Z',JSON.stringify(control));
 sqlite.prepare('INSERT INTO source_reliability_jobs VALUES(?,?,?,?,?,?)').run(id,'AESAN','recent','finished','2026-10-09T09:00:34.445Z',JSON.stringify(receipt));
 sqlite.prepare('INSERT INTO source_sync_state VALUES(?,?,?,?,?,?)').run('AESAN','recent','failed',null,receipt.state.updatedAt,reason);
 const db={prepare(sql){return{sql,params:[],bind(...params){this.params=params;return this;},async first(){return sqlite.prepare(sql).get(...this.params)??null;}};},async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>/^SELECT/u.test(s.sql)?sqlite.prepare(s.sql).all(...s.params):sqlite.prepare(s.sql).run(...s.params));sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const snapshot=()=>({job:sqlite.prepare('SELECT * FROM source_reliability_jobs').get(),state:sqlite.prepare('SELECT * FROM source_sync_state').get()});
 return{sqlite,db,snapshot,control};
}
let checks=0;
{
 const {sqlite,db,snapshot,control}=fixture(),before=snapshot();let commits=0;const batch=db.batch.bind(db);db.batch=async ss=>{commits++;const result=await batch(ss);throw Error('transport lost after commit');};
 const result=await rearmReviewedAesanFailure(db,lease,at,'candidate','runner');assert.equal(result.outcome,'failed');assert.equal(commits,1);assert.deepEqual(snapshot(),before);
 const after=JSON.parse(sqlite.prepare('SELECT state_json FROM source_reliability_control').get().state_json);const expected=structuredClone(control);expected.attempts.AESAN.nextEligibleAt=null;expected.attempts.AESAN.reason='reviewed-exact-official-publication-606';assert.deepEqual(after,expected);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM source_reliability_recoveries').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM source_reliability_effects WHERE committed_at IS NOT NULL').get().n,1);
 await rearmReviewedAesanFailure(db,lease,at,'candidate','runner');assert.equal(commits,1);checks++;
}
for(const mutation of [s=>s.exec("INSERT INTO source_sync_locks VALUES('RASFF')"),s=>s.exec("UPDATE source_reliability_jobs SET receipt_json=json_set(receipt_json,'$.outcome','unknown')"),s=>s.exec("UPDATE source_reliability_control SET epoch=231"),s=>s.exec("UPDATE source_sync_state SET lease_owner_id='other'"),s=>s.exec("UPDATE source_reliability_jobs SET receipt_json=json_set(receipt_json,'$.state.recordsPersisted',1)")]){
 const{sqlite,db,snapshot}=fixture();mutation(sqlite);const before=snapshot(),control=sqlite.prepare('SELECT state_json FROM source_reliability_control').get().state_json;
 await assert.rejects(rearmReviewedAesanFailure(db,lease,at,'candidate','runner'));assert.deepEqual(snapshot(),before);assert.equal(sqlite.prepare('SELECT state_json FROM source_reliability_control').get().state_json,control);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM source_reliability_effects').get().n,0);checks++;
}
{
 const {sqlite,db}=fixture();let attempts=0;db.batch=async()=>{attempts++;throw Error('transport unknown before commit');};await assert.rejects(rearmReviewedAesanFailure(db,lease,at,'candidate','runner'));assert.equal(attempts,1);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM source_reliability_recoveries').get().n,0);checks++;
}
console.log(JSON.stringify({checks,result:'PASS',realSQLite:true,noDomainReplay:true,lostResponseReadMarker:true,noBlindRetry:true}));
