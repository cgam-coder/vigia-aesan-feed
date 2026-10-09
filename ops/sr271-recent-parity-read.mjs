const stop=Date.parse('2026-10-09T13:10:00.000Z');
if(Number(process.env.RUN_ATTEMPT)!==1||Date.now()>stop)throw Error('One read-only diagnostic expired');
const root='https://api.cloudflare.com/client/v4/accounts/9c1807c68493f14259248b5f5782cc6f',db='55596003-1b90-4f66-aad8-decb21205f13';
const sqls=[
{sql:"SELECT source,checked_at,status,official_latest_identity,official_latest_published_at,official_latest_updated_at,latest_identity_parity,missing_official_identities,revision_mismatches,last_sync_success_at,revision_status,revision_last_success_at,error FROM source_freshness_state ORDER BY source"},
{sql:"SELECT f.source,j.value AS missing_reference,a.id,a.reference,a.content_hash,a.version_count,a.published_at,a.updated_at,json_extract(a.canonical_json,'$.dates.officialUpdatedAt.normalized') AS official_updated_at FROM source_freshness_state f JOIN json_each(f.missing_official_identities) j LEFT JOIN alerts a ON a.source=f.source AND a.reference=j.value WHERE f.source IN ('RASFF','OECD') ORDER BY f.source,j.value"},
{sql:"SELECT f.source,j.value AS mismatch_reference,a.id,a.reference,a.content_hash,a.version_count,a.published_at,a.updated_at,json_extract(a.canonical_json,'$.dates.officialUpdatedAt.normalized') AS official_updated_at FROM source_freshness_state f JOIN json_each(f.revision_mismatches) j LEFT JOIN alerts a ON a.source=f.source AND a.reference=j.value WHERE f.source IN ('RASFF','OECD') ORDER BY f.source,j.value"},
{sql:"SELECT source,mode,status,last_success_at,updated_at,last_error,lease_owner_id,cursor,total_units,cursor_key FROM source_sync_state WHERE source IN ('RASFF','OECD') ORDER BY source,mode"},
{sql:"SELECT id,source,mode,phase,started_at,finished_at,receipt_json FROM source_reliability_jobs WHERE source IN ('RASFF','OECD') AND mode='recent' AND started_at>='2026-10-09T12:15:00Z' ORDER BY started_at"}
];
if(sqls.some(x=>!x.sql.startsWith('SELECT ')))throw Error('SELECT-only guard');
const r=await fetch(root+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CF_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({batch:sqls}),signal:AbortSignal.timeout(30000)}),p=await r.json();
if(!r.ok||!p.success||p.result.length!==sqls.length||p.result.some(x=>!x.success||x.meta?.rows_written||x.meta?.changes||x.meta?.served_by_primary!==true))throw Error('Primary SELECT unavailable');
const [audit,missingNow,mismatchNow,states,jobs]=p.result.map(x=>x.results);
console.log('SR271_RECENT_DIVERGENCE_PRIMARY '+JSON.stringify({at:new Date().toISOString(),zeroWrite:true,primarySnapshot:true,audit,missingNow,mismatchNow,states,jobs:jobs.map(j=>({...j,receipt_json:JSON.parse(j.receipt_json??'null')}))}));
