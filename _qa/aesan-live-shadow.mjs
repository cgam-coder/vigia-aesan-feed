import { readFile, writeFile, mkdir } from 'node:fs/promises';
import https from 'node:https';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const out = process.env.SHADOW_DIR;
if (!out || !out.startsWith(process.env.RUNNER_TEMP + '/')) throw new Error('QA_OUTPUT_NOT_TEMPORARY');
await mkdir(join(out, 'raw'), {recursive:true});
const hash = b => createHash('sha256').update(b).digest('hex');
const {parseListCards,parseDetail,sourceIdentityForHtml,officialPagePath,assembleFeed} = await import(pathToFileURL(resolve('scripts/aesan.mjs')));
const {publicationCards,reconcilePublicationBatch} = await import(pathToFileURL(resolve('scripts/aesan-publications.mjs')));
const report = {kind:'bounded live-source read with offline generator shadow', startedAt:new Date().toISOString(), candidate:process.env.QA_TARGET, productionWrites:false, requests:[], status:'running'};
const cache = new Map();
let budget = 60;
const allowed = new Set(['aesan.gob.es','www.aesan.gob.es']);
const fetchHtml = value => {
 const url = new URL(value); url.hash='';
 if (url.protocol !== 'https:' || !allowed.has(url.hostname) || !url.pathname.startsWith('/alertas/')) throw new Error('QA_TARGET_DENIED');
 const key=url.toString();
 if(cache.has(key)) return cache.get(key);
 const p=(async()=>{
  if(--budget<0) throw new Error('QA_REQUEST_BUDGET');
  const startedAt=new Date().toISOString();
  const body=await new Promise((ok,no)=>{
   const request=https.get(url,{family:4,rejectUnauthorized:true,timeout:15000,headers:{'Accept':'text/html','Accept-Encoding':'identity','User-Agent':'NagameAlert-AESAN-source-validation/1.0'}},res=>{
    if(res.statusCode!==200){res.resume();return no(new Error(`QA_HTTP_${res.statusCode}: ${url.pathname}`));}
    let size=0;const parts=[];
    res.on('data',chunk=>{size+=chunk.length;if(size>5_000_000)request.destroy(new Error('QA_BODY_LIMIT'));else parts.push(chunk);});
    res.on('error',no);res.on('end',()=>ok(Buffer.concat(parts)));
   });request.on('timeout',()=>request.destroy(new Error('QA_READ_TIMEOUT')));request.on('error',no);
  });
  const text=body.toString('utf8');if(!/<html|<!doctype/i.test(text))throw new Error('QA_NOT_HTML');
  const digest=hash(body);await writeFile(join(out,'raw',digest+'.html'),body);
  report.requests.push({url:key,startedAt,completedAt:new Date().toISOString(),bytes:body.length,sha256:digest});
  return text;
 })();cache.set(key,p);return p;
};
const bounded = async(values,limit,fn)=>{const result=new Array(values.length);let cursor=0;await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{while(cursor<values.length){const n=cursor++;result[n]=await fn(values[n],n);}}));return result;};
const preload = `import http from 'node:http';import https from 'node:https';import {readFileSync}from'node:fs';import{EventEmitter}from'node:events';const routes=JSON.parse(readFileSync(process.env.QA_ROUTES,'utf8'));const get=(url,opts,callback)=>{const req=new EventEmitter();req.destroy=error=>{queueMicrotask(()=>req.emit('error',error));return req;};setImmediate(()=>{const key=new URL(url);key.hash='';const body=routes[key.toString()];if(body===undefined){req.emit('error',new Error('QA_UNRECORDED_URL'));return;}const res=new EventEmitter();res.statusCode=200;res.headers={};res.resume=()=>{};callback(res);res.emit('data',Buffer.from(body));res.emit('end');});return req;};http.get=get;https.get=get;globalThis.fetch=()=>{throw new Error('QA_NETWORK_FORBIDDEN_DURING_REPLAY');};`;
const currentKeys=['id','reference','sourceRecordId','sourceRecordIdType','sourceRecordHash','contentHash','url','publishedAt','updatedAt','versionCount'];
const projection = row=>Object.fromEntries(currentKeys.map(key=>[key,row[key]]));
try {
 const seedBytes=await readFile('feed.json');const seed=JSON.parse(seedBytes);
 const source='https://www.aesan.gob.es/alertas/buscador-alertas';
 const urls=[source,...[2,3,4].map(n=>source+'/'+n),'https://www.aesan.gob.es/alertas/alertas-alimentarias'];
 const html=await bounded(urls,2,fetchHtml);
 let cards=html.slice(0,4).flatMap(parseListCards);
 const landingRaw=parseListCards(html[4].replace(/\bseeMoreCardSlide\b/gu,'seeMoreCard seeMoreCardSlide'));
 assert.ok(landingRaw.length,'QA_EMPTY_LANDING');
 const landing=await bounded(landingRaw,3,async card=>{
  if(card.reference)return card;const detail=await fetchHtml(card.url);const row=parseDetail(detail,card,null,report.startedAt,sourceIdentityForHtml(detail,card.url));
  return {...card,title:row.title,reference:row.reference,publishedAt:row.publishedAt||card.publishedAt};
 });
 cards=publicationCards([...cards,...landing]);
 const details=await bounded(cards,3,async card=>({card,html:await fetchHtml(card.url)}));
 const fixture=JSON.parse(await readFile('test/fixtures/aesan-publications-177.json','utf8'));
 const targeted=await bounded([fixture.earlier,fixture.later],2,async card=>({card,html:await fetchHtml(card.url)}));
 const routes=Object.fromEntries(await Promise.all([...cache].map(async([url,p])=>[url,await p])));
 await writeFile(join(out,'routes.json'),JSON.stringify(routes));await writeFile(join(out,'preload.mjs'),preload);
 const output=join(out,'shadow-feed.json');await writeFile(output,seedBytes);
 const invoke=()=>{
  const p=spawnSync(process.execPath,['--import',join(out,'preload.mjs'),resolve('scripts/update-feed.mjs')],{encoding:'utf8',timeout:30000,maxBuffer:4_000_000,env:{OUTPUT_PATH:output,QA_ROUTES:join(out,'routes.json'),AESAN_FULL_HISTORY:'0',AESAN_PAGES:'4',AESAN_MAX_ARCHIVE_PAGES:'400'}});
  if(p.error)throw p.error;if(p.status!==0)throw new Error('QA_CLI_FAILED: '+p.stderr.slice(-4000));return p.stdout;
 };
 await writeFile(join(out,'cli-first.log'),invoke());const firstBytes=await readFile(output);const feed=JSON.parse(firstBytes);
 await writeFile(join(out,'cli-replay.log'),invoke());const secondBytes=await readFile(output);
 assert.deepEqual(secondBytes,firstBytes,'QA_REPLAY_CHANGED_FEED');
 for(const key of ['id','reference','sourceRecordId'])assert.equal(new Set(feed.alerts.map(a=>a[key])).size,feed.alerts.length,'QA_DUPLICATE_'+key);
 const oldIDs=new Map(seed.alerts.map(a=>[a.reference,a.id]));
 for(const row of feed.alerts)if(oldIDs.has(row.reference))assert.equal(row.id,oldIDs.get(row.reference),'QA_CHANGED_STABLE_ID');
 for(const row of seed.alerts)assert.ok(feed.alerts.some(a=>a.id===row.id),'QA_LOST_ARCHIVED_ID');
 const byID=new Map(seed.alerts.map(a=>[a.id,a]));
 report.currentChanges=feed.alerts.flatMap(row=>{const before=byID.get(row.id);if(!before)return[{kind:'new',after:projection(row)}];const keys=currentKeys.filter(key=>row[key]!==before[key]);return keys.length?[{kind:'changed',keys,before:projection(before),after:projection(row)}]:[];});
 report.newHistory=feed.alerts.filter(row=>JSON.stringify(row.publicationHistory??[])!==JSON.stringify(byID.get(row.id)?.publicationHistory??[])).map(row=>({reference:row.reference,states:row.publicationHistory?.length??0}));
 const reconciled=reconcilePublicationBatch(seed.alerts,targeted,report.startedAt);
 const row=reconciled.find(a=>a.reference==='ES2026/177');
 assert.equal(row.url,fixture.later.url,'QA_WRONG_177_PUBLICATION');assert.match(JSON.stringify(row.publishedFields),/361614/u);
 assert.equal(row.id,fixture.later.id);assert.equal(row.sourceRecordId,fixture.later.sourceRecordId);
 const oldOnly=reconcilePublicationBatch([row],[targeted[0]],new Date(Date.now()+60000).toISOString())[0];
 assert.deepEqual(projection(oldOnly),projection(row),'QA_LATE_OLD_PAGE_REGRESSION');
 assert.deepEqual(oldOnly.publicationHistory,row.publicationHistory,'QA_HISTORY_REPLAY_CHANGED');
 const targetedFeed=assembleFeed(seed,reconciled,report.startedAt);
 await writeFile(join(out,'targeted-shadow-feed.json'),JSON.stringify(targetedFeed,null,2));
 report.targeted177={current:projection(row),publicationHistory:row.publicationHistory?.map(p=>({url:p.url,sourceRecordId:p.sourceRecordId,publishedAt:p.publishedAt,sourceRecordHash:p.sourceRecordHash})),lateOldReplay:'pass',lot361614:true};
 report.recent={cards:cards.length,details:details.length,initialAlerts:seed.alerts.length,finalAlerts:feed.alerts.length,seedSha256:hash(seedBytes),outputSha256:hash(firstBytes),replay:'byte-identical'};
 report.scope='Four recent search pages and landing, plus the two ES2026/177 publication pages. Not full historical source audit or D1 audit. All output is temporary; no source or runtime writes.';
 report.status='success';
} catch(error) {report.status='failed';report.error={name:error.name,message:error.message,code:error.code??null};process.exitCode=1;}
finally {report.finishedAt=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
