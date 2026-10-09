import {createD1AlertStore} from '../lib/persistence/d1-alert-store';
import type {LegacyRecoveryManifest} from '../lib/reliability-legacy-manifest';
import type {ReliabilityControlLease} from '../lib/reliability-control-store';
import type {ReliabilitySourceReceipt} from '../lib/reliability-source-runner';

type Value=string|number|null;
const oldId='8f5b996c-b058-4864-8472-ec2836e6274a';
const quote=(x:string)=>'"'+x.replaceAll('"','""')+'"';
export function compactPreimage(p:LegacyRecoveryManifest['preimages'][number]){
 if(!/^SELECT \* FROM (?:source_reliability_jobs|source_sync_state|source_sync_locks|source_revision_certifications|source_checks|alerts|alert_source_identities|alert_versions|alert_aliases|alert_dimension_state|alert_categories|alert_hazards|alert_geographies|alert_actors)\b/u.test(p.sql)||p.params.length>90)throw Error('Unapproved compact preimage');
 const names=Object.keys(p.rows[0]??{});if(!names.length)return{sql:"SELECT CASE WHEN NOT EXISTS("+p.sql+") THEN '[]' ELSE 'unproved-presence' END",params:p.params,expected:'[]'};
 const arrays=[];for(let i=0;i<names.length;i+=16)arrays.push('json_array('+names.slice(i,i+16).map(quote).join(',')+')');
 const expected=JSON.stringify(p.rows.map(r=>{const chunks=[];for(let i=0;i<names.length;i+=16)chunks.push(names.slice(i,i+16).map(k=>r[k]));return chunks;}));
 return{sql:'SELECT json_group_array(json_array('+arrays.join(',')+')) FROM ('+p.sql+')',params:p.params,expected};
}

/** Distinct current-state CAS. The original large transaction is NEVER resent. */
export async function reconcileCompactSafetyGate(db:D1Database,manifest:LegacyRecoveryManifest,hash:string,lease:ReliabilityControlLease,at:string,report:(tag:string,value:unknown)=>void=()=>{}){
 const prior=await db.prepare('SELECT manifest_hash,receipt_json FROM source_reliability_recoveries WHERE old_job_id=?').bind(oldId).first<{manifest_hash:string;receipt_json:string}>();if(prior){if(prior.manifest_hash!==hash)throw Error('Different recovery already committed');return true;}
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(manifest))),actualHash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const age=Date.parse(at)-Date.parse(manifest.observedAt);
 if(hash!==actualHash||manifest.oldJobId!==oldId||manifest.job.epoch!==2||manifest.job.receipt_json!==null||manifest.job.finished_at!==null||manifest.state.source!=='SAFETY GATE'||manifest.state.mode!=='recent'||manifest.state.cursor!==0||manifest.state.lease_owner_id!==oldId||!manifest.covered||manifest.official.missing.length||manifest.official.mismatches.length||age<0||age>30*60000||lease.epoch<=194)throw Error('Compact recovery baseline unproved');
 const parentKey='legacy-reconcile:'+oldId+':'+hash,key='legacy-reconcile-compact:'+oldId+':'+hash;
 const parent=await db.prepare('SELECT manifest_json,committed_at,result_json FROM source_reliability_effects WHERE effect_key=? AND job_id=? AND ordinal=-1').bind(parentKey,oldId).first<{manifest_json:string;committed_at:string|null;result_json:string|null}>();
 if(!parent||parent.committed_at!==null||parent.result_json!==null)throw Error('Original unfinished intent differs');
 const parentBody=JSON.parse(parent.manifest_json) as {manifestHash:string;originalJob:unknown;originalState:unknown};
 if(parentBody.manifestHash!==hash||JSON.stringify(parentBody.originalJob)!==JSON.stringify(manifest.job)||JSON.stringify(parentBody.originalState)!==JSON.stringify(manifest.state))throw Error('Original intent preimages differ');
 if(await db.prepare('SELECT effect_key FROM source_reliability_effects WHERE effect_key=?').bind(key).first())throw Error('Compact intent already exists; marker reconciliation only, never resend');
 const state=await createD1AlertStore(db).readSyncState!('SAFETY GATE','recent');
 if(!state||state.cursor!==0||state.updatedAt!==manifest.state.updated_at||state.leaseOwnerId!==oldId)throw Error('Source state changed');
 const recoveryId=crypto.randomUUID(),restored={...state,status:'partial' as const,leaseOwnerId:null,leaseMode:null,leaseExpiresAt:null,lastError:null,updatedAt:at};
 const receipt:ReliabilitySourceReceipt&{reconciliation:unknown}={id:oldId,source:'SAFETY GATE',mode:'recent',kind:'recent',startedAt:String(manifest.job.started_at),finishedAt:at,outcome:'partial',state:restored,requests:0,batches:0,reason:'compact-current-effects-reconciled-no-domain-replay',pendingDetails:[],reconciliation:{recoveryId,manifestHash:hash,originalTransportResult:'unknown',originalReceipt:null,originalRecoveryIntent:parentKey,originalRecoveryTransactionResult:'unconfirmed-and-fenced',invalidatedCoordinatorEpoch:194,replacementCoordinatorEpoch:lease.epoch,scope:'verified-current-effects-and-durable-cursor',missingLeftForDistinctNaturalAttempt:[]}};
 const text=JSON.stringify(receipt);
 const fenceSql=`SELECT CASE WHEN EXISTS(SELECT 1 FROM source_reliability_control WHERE id=1 AND owner_id=? AND epoch=? AND expires_at>? AND json_extract(state_json,'$.attempts."SAFETY GATE".id')=?)
 AND NOT EXISTS(SELECT 1 FROM source_sync_locks WHERE source='SAFETY GATE' AND (owner_id!=? OR expires_at>?))
 AND EXISTS(SELECT 1 FROM source_reliability_jobs WHERE id=? AND epoch=2 AND deadline<? AND receipt_json IS NULL AND finished_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM source_reliability_recoveries WHERE old_job_id=?)
 AND EXISTS(SELECT 1 FROM source_reliability_effects WHERE effect_key=? AND manifest_json=? AND committed_at IS NULL AND result_json IS NULL)
 THEN 1 ELSE json('compact-recovery-fence-lost') END`;
 const fence=()=>db.prepare(fenceSql).bind(lease.ownerId,lease.epoch,at,oldId,oldId,at,oldId,Date.parse(at),oldId,parentKey,parent.manifest_json);
 const proofs=manifest.preimages.map((p,index)=>{const image=compactPreimage(p),proofKey='legacy-preimage:'+oldId+':'+hash+':'+index,body=JSON.stringify({schemaVersion:1,kind:'verified-current-preimage',oldJobId:oldId,manifestHash:hash,index,...image});if(new TextEncoder().encode(body).byteLength>1900000)throw Error('Proof exceeds safe row limit');return{...image,index,proofKey,body};});
 let staged=0;
 // Each evidence row is a bounded transaction with the exact current CAS.
 // A lost stage response is resolved by its unique marker, never by resend.
 for(const proof of proofs){
  const existing=await db.prepare('SELECT manifest_json,committed_at FROM source_reliability_effects WHERE effect_key=?').bind(proof.proofKey).first<{manifest_json:string;committed_at:string|null}>();
  if(existing){if(existing.manifest_json!==proof.body||!existing.committed_at)throw Error('Existing proof differs');continue;}
  try{await db.batch([fence(),db.prepare(`SELECT CASE WHEN (${proof.sql}) IS ? THEN 1 ELSE json('compact-preimage-CAS-lost') END`).bind(...proof.params,proof.expected),db.prepare('INSERT INTO source_reliability_effects(effect_key,job_id,source,mode,ordinal,manifest_json,committed_at,result_json) VALUES(?,?,?,? ,?,?,?,?)').bind(proof.proofKey,oldId,'SAFETY GATE','recent',-1000-proof.index,proof.body,at,JSON.stringify({kind:'verified-preimage',manifestHash:hash}))]);}
  catch(error){const saved=await db.prepare('SELECT manifest_json,committed_at FROM source_reliability_effects WHERE effect_key=?').bind(proof.proofKey).first<{manifest_json:string;committed_at:string|null}>().catch(()=>null);if(saved?.manifest_json!==proof.body||!saved.committed_at)throw error;}
  staged++;
 }
 const guards=proofs.map(proof=>db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM source_reliability_effects WHERE effect_key=? AND job_id=? AND committed_at IS NOT NULL AND json_extract(manifest_json,'$.manifestHash')=? AND json_extract(manifest_json,'$.index')=?) AND (${proof.sql}) IS (SELECT json_extract(manifest_json,'$.expected') FROM source_reliability_effects WHERE effect_key=?) THEN 1 ELSE json('compact-proof-CAS-lost') END`).bind(proof.proofKey,oldId,hash,proof.index,...proof.params,proof.proofKey));
 // This probes the compact transaction's READ capacity before any commit intent.
 await db.batch([fence(),...guards]);report('R9_COMPACT_PROOFS',{at,hash,count:proofs.length,newlyStaged:staged,compactReadPassed:true,originalEpochFenced:true});
 const description=JSON.stringify({schemaVersion:1,kind:'distinct-current-state-reconciliation',oldJobId:oldId,manifestHash:hash,recoveryId,parentEffectKey:parentKey,originalTransactionResult:'unconfirmed-and-fenced',coordinatorEpoch:lease.epoch,proofKeys:proofs.map(p=>p.proofKey)});
 try{await db.batch([fence(),db.prepare('INSERT INTO source_reliability_effects(effect_key,job_id,source,mode,ordinal,manifest_json) VALUES(?,?,?,?, -2,?)').bind(key,oldId,'SAFETY GATE','recent',description)]);}
 catch(error){const planned=await db.prepare('SELECT manifest_json,committed_at FROM source_reliability_effects WHERE effect_key=?').bind(key).first<{manifest_json:string;committed_at:string|null}>().catch(()=>null);if(planned?.manifest_json!==description||planned.committed_at!==null)throw error;}
 const closure=JSON.stringify({schemaVersion:1,outcome:'resolved-by-distinct-fenced-current-CAS',originalTransactionResult:'unconfirmed-and-fenced',replacementEffectKey:key,invalidatedCoordinatorEpoch:194,replacementCoordinatorEpoch:lease.epoch,receipt});
 try{await db.batch([fence(),...guards,db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM source_reliability_effects WHERE effect_key=? AND manifest_json=? AND committed_at IS NULL) THEN 1 ELSE json('compact-commit-already-used') END").bind(key,description),
  db.prepare('INSERT INTO source_reliability_recoveries(old_job_id,recovery_id,manifest_hash,original_job_json,original_state_json,receipt_json,committed_at) VALUES(?,?,?,?,?,?,?)').bind(oldId,recoveryId,hash,JSON.stringify(manifest.job),JSON.stringify(manifest.state),text,at),
  db.prepare("UPDATE source_sync_state SET status='partial',lease_owner_id=NULL,lease_mode=NULL,lease_expires_at=NULL,last_error=NULL,updated_at=? WHERE source='SAFETY GATE' AND mode='recent' AND lease_owner_id=? AND updated_at=?").bind(at,oldId,state.updatedAt),
  db.prepare("DELETE FROM source_sync_locks WHERE source='SAFETY GATE' AND owner_id=? AND expires_at<=?").bind(oldId,at),
  db.prepare("UPDATE source_reliability_jobs SET phase='reconciled',finished_at=?,receipt_json=? WHERE id=? AND epoch=2 AND receipt_json IS NULL AND finished_at IS NULL").bind(at,text,oldId),
  db.prepare('UPDATE source_reliability_effects SET committed_at=?,result_json=? WHERE effect_key=? AND manifest_json=? AND committed_at IS NULL').bind(at,text,key,description),
  db.prepare('UPDATE source_reliability_effects SET committed_at=?,result_json=? WHERE effect_key=? AND manifest_json=? AND committed_at IS NULL AND result_json IS NULL').bind(at,closure,parentKey,parent.manifest_json),
 ]);}catch(error){const committed=await db.prepare('SELECT manifest_hash,receipt_json FROM source_reliability_recoveries WHERE old_job_id=?').bind(oldId).first<{manifest_hash:string;receipt_json:string}>().catch(()=>null);if(committed?.manifest_hash!==hash||committed.receipt_json!==text)throw error;}
 report('R9_COMPACT_RECOVERY_COMMITTED',{at,key,receipt,parentResolvedByReplacement:true,noDomainReplay:true});return true;
}
