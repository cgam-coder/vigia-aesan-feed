'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {createRequire}=require('node:module');
const npmRequire=createRequire(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'npm/package.json'));
const Arborist=npmRequire('@npmcli/arborist');
const {checkPlatform}=npmRequire('npm-install-checks');
function applicable(p){try{checkPlatform(p);return true;}catch(e){if(e.code==='EBADPLATFORM')return false;throw e;}}
function audit(tree,locked){
 const visited=new Set(),issues=[],platformOmissions=[];
 const queue=[tree];
 while(queue.length){
  const n=queue.shift();if(visited.has(n))continue;visited.add(n);
  for(const e of n.edgesOut.values()){
   if(e.type==='dev'||(e.type==='peerOptional'&&!e.to))continue;
   if(e.type==='optional'){
    let target=e.to?.package;
    if(!target){
     const candidates=Object.entries(locked.packages).filter(([k,p])=>k.endsWith('/'+e.name)&&p.version===e.spec).map(([,p])=>p);
     if(candidates.length && candidates.every(p=>!applicable(p))){platformOmissions.push({from:n.location,name:e.name,reason:'declared foreign-platform optional dependency'});continue;}
    }else if(!applicable(target)){platformOmissions.push({from:n.location,name:e.name,reason:'optional dependency not applicable to host'});continue;}
   }
   if(!e.valid)issues.push({from:n.location,name:e.name,type:e.type,want:e.spec,found:e.to?.version||null,error:e.error||'INVALID'});
   if(e.to)queue.push(e.to);
  }
 }
 return {platform:process.platform,arch:process.arch,runtimeNodes:visited.size,issues,platformOmissions,
   nonRuntimeNodes:[...tree.inventory.values()].filter(n=>!visited.has(n)).map(n=>({path:n.location,version:n.version,extraneous:n.extraneous})),
   decision:issues.length?'FAIL_RUNTIME_DEPENDENCIES':'RUNTIME_GRAPH_VALID'};
}
async function main(dir){const locked=JSON.parse(fs.readFileSync(path.join(dir,'package-lock.json')));const tree=await new Arborist({path:dir,offline:true}).loadActual();const out=audit(tree,locked);console.log(JSON.stringify(out,null,2));return out.issues.length?1:0;}
module.exports={audit,applicable};
if(require.main===module)main(path.resolve(process.argv[2])).then(c=>{process.exitCode=c;}).catch(e=>{console.error(e.stack);process.exitCode=2;});
