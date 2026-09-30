const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const WORKER="vigia-runtime";
const CF="https://api.cloudflare.com/client/v4";
const RUNTIME="https://vigia-runtime.c-gamiz93.workers.dev";
const SG="https://ec.europa.eu/safety-gate-alerts";
const cfToken=process.env.CLOUDFLARE_API_TOKEN;
const syncToken=process.env.VIGIA_SYNC_TOKEN;
if(!cfToken||!syncToken) throw new Error("credential-not-configured");

const cfHeaders={Authorization:`Bearer ${cfToken}`,Accept:"application/json"};
const stable=(value)=>{
  if(Array.isArray(value)) return value.map(stable).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if(value&&typeof value==="object") return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));
  return value;
};
const text=(v)=>typeof v==="string"&&v.trim()?v.trim():null;
const projection=(detail)=>{
  if(!detail||typeof detail!=="object"||Array.isArray(detail)) return null;
  const semantic=structuredClone(detail);
  const modificationDate=semantic.modificationDate;
  delete semantic.creationDate;
  delete semantic.publicationDate;
  delete semantic.modificationDate;
  delete semantic.versions;
  delete semantic.webReport;
  if(text(detail.corrigendum)&&text(modificationDate)) semantic.modificationDate=text(modificationDate);
  return stable(semantic);
};
const topDiffs=(a,b)=>{
  const A=a&&typeof a==="object"?a:{};
  const B=b&&typeof b==="object"?b:{};
  return [...new Set([...Object.keys(A),...Object.keys(B)])].filter(k=>JSON.stringify(A[k])!==JSON.stringify(B[k])).sort();
};
const shape=(value)=>{
  if(value===null) return {type:"null",keys:[]};
  if(Array.isArray(value)) return {type:"array",keys:[]};
  if(typeof value==="object") return {type:"object",keys:Object.keys(value).sort()};
  return {type:typeof value,keys:[]};
};
const nestedDiffPaths=(a,b,prefix="",out=[])=>{
  if(JSON.stringify(stable(a))===JSON.stringify(stable(b))) return out;
  const ao=a&&typeof a==="object"&&!Array.isArray(a), bo=b&&typeof b==="object"&&!Array.isArray(b);
  if(!ao||!bo){out.push(prefix||"<root>");return out;}
  for(const key of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()){
    nestedDiffPaths(a[key],b[key],prefix?`${prefix}.${key}`:key,out);
  }
  return out;
};
const fetchJson=async(url,init={},timeout=60000)=>{
  const r=await fetch(url,{...init,signal:AbortSignal.timeout(timeout)});
  const raw=await r.text();
  let body=null; try{body=JSON.parse(raw);}catch{}
  return {r,body};
};

// 1) Re-run the authoritative zero-write shadow once and capture only metrics/refs in memory.
const shadow=await fetchJson(`${RUNTIME}/api/safety-gate/sync?mode=delta-shadow`,{
  method:"POST",
  headers:{Authorization:`Bearer ${syncToken}`},
},1_800_000);
const s=shadow.body?.shadow;
if(!s||s.zeroWrite!==true||s.hydrationComplete!==true||s.detailFailures!==0)
  throw new Error("shadow-not-forensically-usable");
const refs=Array.isArray(s.falseNegativeReferences)?s.falseNegativeReferences.filter(x=>typeof x==="string"):[];
if(!refs.length) throw new Error("no-false-negatives-to-classify");

// 2) Resolve the production D1 binding without hard-coding database identifiers.
const settings=await fetchJson(`${CF}/accounts/${ACCOUNT}/workers/scripts/${WORKER}/settings`,{headers:cfHeaders});
if(!settings.r.ok||settings.body?.success===false) throw new Error("worker-settings-read-failed");
const bindings=Array.isArray(settings.body?.result?.bindings)?settings.body.result.bindings:[];
const dbBinding=bindings.find(b=>b?.name==="DB"&&typeof b?.id==="string") ??
  bindings.find(b=>b?.name==="DB"&&typeof b?.database_id==="string");
const dbId=dbBinding?.id??dbBinding?.database_id;
if(typeof dbId!=="string"||!dbId) throw new Error("d1-binding-not-found");

// 3) Pull a deterministic bounded sample of stored canonical rows from D1.
const sampleRefs=[...refs].sort().slice(0,32);
const placeholders=sampleRefs.map(()=>"?").join(",");
const d1=await fetchJson(`${CF}/accounts/${ACCOUNT}/d1/database/${dbId}/query`,{
  method:"POST",
  headers:{...cfHeaders,"Content-Type":"application/json"},
  body:JSON.stringify({
    sql:`SELECT reference, canonical_json AS canonicalJson FROM alerts WHERE source='SAFETY GATE' AND reference IN (${placeholders}) ORDER BY reference`,
    params:sampleRefs,
  }),
});
if(!d1.r.ok||d1.body?.success===false) throw new Error("d1-read-failed");
const rows=(Array.isArray(d1.body?.result)?d1.body.result.flatMap(x=>Array.isArray(x?.results)?x.results:[]):[]);
const rowByRef=new Map(rows.map(row=>[row.reference,row]));

const histogram={};
let currentJsonStored=0, weeklyStored=0, projectionChanged=0, projectionEqual=0, fetchFailures=0, missingRows=0;
const singlePublication={storedShapes:{},currentShapes:{},changedPaths:{}};
for(const ref of sampleRefs){
  const row=rowByRef.get(ref);
  if(!row){missingRows++;continue;}
  let canonical=null; try{canonical=JSON.parse(row.canonicalJson??"{}");}catch{}
  const storedDetail=canonical?.sourceRecord?.detail??null;
  const sourceRecordId=Number(canonical?.identity?.sourceRecordId);
  if(!Number.isSafeInteger(sourceRecordId)){missingRows++;continue;}
  const storedCurrentJsonShape=Boolean(storedDetail?.product||storedDetail?.risk||storedDetail?.measureTaken);
  if(storedCurrentJsonShape) currentJsonStored++; else weeklyStored++;
  const official=await fetchJson(`${SG}/public/api/notification/${sourceRecordId}?language=es`,{
    headers:{Accept:"application/json",language:"es"},
  },30_000);
  if(!official.r.ok||!official.body){fetchFailures++;continue;}
  const storedShape=shape(storedDetail?.singlePublication);
  const currentPublicationShape=shape(official.body?.singlePublication);
  const storedKey=JSON.stringify(storedShape), currentKey=JSON.stringify(currentPublicationShape);
  singlePublication.storedShapes[storedKey]=(singlePublication.storedShapes[storedKey]??0)+1;
  singlePublication.currentShapes[currentKey]=(singlePublication.currentShapes[currentKey]??0)+1;
  for(const path of nestedDiffPaths(storedDetail?.singlePublication,official.body?.singlePublication)){
    singlePublication.changedPaths[path]=(singlePublication.changedPaths[path]??0)+1;
  }
  const a=projection(storedDetail), b=projection(official.body);
  if(JSON.stringify(a)===JSON.stringify(b)){projectionEqual++;continue;}
  projectionChanged++;
  for(const key of topDiffs(a,b)) histogram[key]=(histogram[key]??0)+1;
}

const output={
  status:"PASS_READONLY",
  shadow:{
    httpStatus:shadow.r.status,
    totalDeclared:s.discovery?.totalDeclared??null,
    recordsObserved:s.recordsObserved??null,
    hydratedCount:s.hydratedCount??null,
    materialChangeCount:s.materialChangeCount??null,
    candidateCount:s.candidateCount??null,
    truePositiveCount:s.truePositiveCount??null,
    falsePositiveCount:s.falsePositiveCount??null,
    falseNegativeCount:s.falseNegativeCount??null,
  },
  forensicSample:{
    requested:sampleRefs.length,
    d1Rows:rows.length,
    missingRows,
    currentJsonStored,
    weeklyStored,
    projectionChanged,
    projectionEqual,
    officialFetchFailures:fetchFailures,
    changedTopLevelHistogram:histogram,
    singlePublication,
  },
  interpretation:{
    projectionChangedMeans:"stored official detail differs from current official detail after the same material projection exclusions used by runtime",
    projectionEqualMeans:"shadow hash drift is not explained by the raw official detail projection and needs canonical/parser-baseline analysis",
  },
};
console.log("SAFETY_GATE_F2A_FN_FORENSICS "+JSON.stringify(output));
if(fetchFailures>2||missingRows>2) process.exitCode=1;
