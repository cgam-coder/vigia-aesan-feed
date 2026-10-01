'use strict';
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
(async()=>{
 const dir=path.resolve(process.argv[2]),local=createRequire(path.join(dir,'package.json'));
 const driver=local('appium-xcuitest-driver');
 if(typeof driver.XCUITestDriver!=='function')throw Error('Published XCUITest entrypoint did not load');
 const lock=JSON.parse(fs.readFileSync(path.join(dir,'package-lock.json'))),images=[];
 for(const [name,pkg] of Object.entries(lock.packages)){
  if(!name.endsWith('/sharp'))continue;
  const packageFile=path.join(dir,name,'package.json');if(!fs.existsSync(packageFile))continue;
  const sharp=local(path.dirname(packageFile));
  const out=await sharp({create:{width:1,height:1,channels:4,background:{r:0,g:0,b:0,alpha:1}}}).png().toBuffer();
  if(out.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Image dependency smoke did not produce PNG');
  images.push({package:name,version:pkg.version,pngBytes:out.length});
 }
 if(!images.length)throw Error('No image dependency tested');
 console.log(JSON.stringify({driverEntrypoint:'LOADED',sharpSmoke:images,scope:'host dependency imports only; no session or native UI'},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
