#!/usr/bin/env node
'use strict';
// Read-only, offline check with the Arborist shipped with the installed npm.
// This checks the locked dependency graph, including optional platform packages.
// It does NOT install packages, change the lock, run Appium or certify macOS.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const {execFileSync} = require('node:child_process');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function inspect(directory) {
  const dir = fs.realpathSync(directory);
  const filenames = ['package.json','package-lock.json'];
  for (const name of filenames) {
    const st = fs.lstatSync(path.join(dir,name));
    if (!st.isFile() || st.isSymbolicLink()) throw Error('Expected regular file: '+name);
  }
  const before = Object.fromEntries(filenames.map(n=>[n,hash(path.join(dir,n))]));
  const manifest = JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(dir,'package-lock.json'),'utf8'));
  if (lock.lockfileVersion !== 3 || !lock.packages || !lock.packages['']) throw Error('Expected package-lock v3 with root package');
  let npmRequire;
  if (process.env.npm_execpath) npmRequire = createRequire(fs.realpathSync(process.env.npm_execpath));
  else {
    const root = execFileSync('npm',['root','-g'],{encoding:'utf8',timeout:5000}).trim();
    npmRequire = createRequire(path.join(root,'npm','package.json'));
  }
  const Arborist = npmRequire('@npmcli/arborist');
  const tree = await new Arborist({path:dir,offline:true,ignoreScripts:true,audit:false}).loadVirtual();
  const defects = [];
  for (const group of ['dependencies','devDependencies','optionalDependencies','peerDependencies']) {
    const a=manifest[group]||{},b=lock.packages[''][group]||{};
    for (const name of new Set([...Object.keys(a),...Object.keys(b)])) {
      if(a[name]!==b[name]) defects.push({source:'root',name,type:group,error:'MANIFEST_LOCK_DISAGREEMENT',requested:a[name]??null,locked:b[name]??null});
    }
  }
  for (const node of tree.inventory.values()) {
    for (const edge of node.edgesOut.values()) {
      // Absent optional peers can be legitimate. OptionalDependencies are instead
      // required in this cross-platform completeness gate, even if not installed.
      const error = edge.error || (!edge.to && edge.type === 'optional' ? 'MISSING_OPTIONAL_IN_LOCK' : null);
      if (error) defects.push({source:node.location,name:edge.name,requested:edge.spec,type:edge.type,error,resolved:edge.to?.version??null});
    }
  }
  const after=Object.fromEntries(filenames.map(n=>[n,hash(path.join(dir,n))]));
  if(JSON.stringify(before)!==JSON.stringify(after)) throw Error('Input changed during inspection');
  return {
    schema:1,
    scope:'offline locked graph only; not an installation or native certification',
    node:process.version,npm:npmRequire('npm/package.json').version,
    platform:process.platform,arch:process.arch,
    hashes:before,inputsUnchanged:true,nodes:tree.inventory.size,
    decision:defects.length?'REJECT_LOCK_GRAPH':'GRAPH_CONSISTENT_NOT_INSTALL_VALIDATED',
    defects
  };
}
if(require.main===module) {
  if(process.argv.length!==3){console.error('Usage: node check_lock_graph.cjs <directory-with-package-json-and-lock>');process.exitCode=2;}
  else inspect(process.argv[2]).then(r=>{console.log(JSON.stringify(r,null,2));process.exitCode=r.defects.length?1:0;}).catch(e=>{console.error(e.message);process.exitCode=2;});
}
module.exports={inspect};
