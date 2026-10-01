'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
(async()=>{
 const target=path.resolve(process.argv[2]);
 const root=cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
 const Arborist=require(path.join(root,'npm/node_modules/@npmcli/arborist'));
 const tree=await new Arborist({path:target,offline:true}).loadVirtual();
 const bad=[];
 for(const node of tree.inventory.values()) for(const edge of node.edgesOut.values()) {
  if(edge.type==='peerOptional'&&!edge.to)continue;
  if(!edge.valid || (edge.type==='optional'&&!edge.to))bad.push({from:node.location,name:edge.name,want:edge.spec,found:edge.to?.version||null,error:edge.error||'MISSING_OPTIONAL'});
 }
 const l=JSON.parse(fs.readFileSync(path.join(target,'package-lock.json')));
 for(const [name,p] of Object.entries(l.packages))if(name){
  if(!p.resolved?.startsWith('https://registry.npmjs.org/')||!p.integrity?.startsWith('sha512-'))throw Error('Unreviewed dependency origin/integrity: '+name);
 }
 const sharp=Object.values(l.packages).filter(p=>p.optionalDependencies?.['@img/sharp-darwin-arm64']);
 if(!sharp.length||sharp.some(p=>p.version!=='0.34.3'))throw Error('Sharp graph is not unified at reviewed version');
 for(const arch of ['arm64','x64'])for(const [n,v] of [['sharp','0.34.3'],['sharp-libvips','1.2.0']]) {
  if(!Object.entries(l.packages).some(([k,p])=>k.endsWith('/@img/'+n+'-darwin-'+arch)&&p.version===v))throw Error('Missing Darwin package '+n+' '+arch);
 }
 console.log(JSON.stringify({scope:'complete locked dependency graph, not native execution',nodes:tree.inventory.size,defects:bad},null,2));
 if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
