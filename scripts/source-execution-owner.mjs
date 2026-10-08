import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
// Execution ownership is independent of freshness. A degraded native owner must
// never cause a legacy producer to take over without a coordinated rollback.
export async function sourceExecutionOwner({baseUrl,token,fetchImpl=fetch}) {
  const base=new URL(baseUrl);
  if(!token||base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('Invalid ownership configuration');
  const response=await fetchImpl(new URL('/api/source-reliability?observe=1',base),{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(response.status===404)return {legacyAllowed:true,nativeOwned:false,reason:'legacy-runtime'};
  const body=await response.json();
  if([200,503].includes(response.status)&&body?.mode==='five-source-coordinated')return {legacyAllowed:false,nativeOwned:true,reason:'native-execution-owner'};
  if(response.status===200&&body?.outcome==='disabled'&&[null,'shadow','rapna-pilot','rapna-rasff-pilot','rapna-rasff-oecd-pilot'].includes(body.mode))return {legacyAllowed:true,nativeOwned:false,reason:'known-legacy-mode'};
  throw Error('Execution ownership HOLD; no legacy takeover');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const result=await sourceExecutionOwner({baseUrl:process.env.VIGIA_BASE_URL,token:process.env.VIGIA_SYNC_TOKEN});
    if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`legacy_allowed=${result.legacyAllowed}\nnative_owned=${result.nativeOwned}\n`);
    console.log('SOURCE_OWNER '+JSON.stringify({...result,officialParityCertified:false}));
  }catch{console.error('SOURCE_OWNER HOLD: execution ownership unavailable; no mutation authorized');process.exitCode=1;}
}
