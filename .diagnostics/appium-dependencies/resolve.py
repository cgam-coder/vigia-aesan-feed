"""Dependency-only preparation: no Apple runner, browser, product or credentials."""
import hashlib,json,os,shutil,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUT=Path(os.environ['RUNNER_TEMP'])/'appium-reviewed-deps'
WORK=Path(os.environ['RUNNER_TEMP'])/'appium-deps-build'
OUT.mkdir(exist_ok=False);WORK.mkdir(exist_ok=False)
proof={'schema':1,'scope':'dependency resolution and clean install only','commands':[],'status':'STARTED'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def cmd(args,cwd,timeout=120,name=None):
    index=len(proof['commands'])+1;log=OUT/(name or f'{index:02d}-dependency.log')
    entry={'argv':args,'log':log.name,'startedMs':round(time.time()*1000)};proof['commands'].append(entry)
    with log.open('xb') as f:
        r=subprocess.run(args,cwd=cwd,stdout=f,stderr=subprocess.STDOUT,timeout=timeout)
    entry.update(code=r.returncode,finishedMs=round(time.time()*1000))
    (OUT/'dependency-proof.json').write_text(json.dumps(proof,indent=2))
    if r.returncode:raise RuntimeError('Dependency command failed; see '+log.name)
    return log.read_text()
try:
    proof['node']=cmd(['node','--version'],WORK).strip();proof['npm']=cmd(['npm','--version'],WORK).strip()
    assert proof['node']=='v22.16.0' and proof['npm']=='10.9.2','Toolchain mismatch'
    shutil.copy2(ROOT/'package.json',WORK/'package.json')
    cmd(['npm','install','--package-lock-only','--ignore-scripts','--include=optional','--no-audit','--no-fund'],WORK,180,'03-resolve.log')
    lock=WORK/'package-lock.json';before=sha(lock)
    for name in ('package.json','package-lock.json'):shutil.copy2(WORK/name,OUT/name)
    proof['hashes']={n:sha(OUT/n) for n in ('package.json','package-lock.json')}
    (OUT/'dependency-proof.json').write_text(json.dumps(proof,indent=2))
    cmd(['node',str(ROOT/'check-graph.cjs'),str(WORK)],WORK,30,'04-graph.json')
    cmd(['npm','ci','--ignore-scripts','--include=optional','--no-audit','--no-fund'],WORK,180,'05-clean-install.log')
    assert sha(lock)==before,'npm ci changed the lock'
    cmd(['npm','ls','--all','--json'],WORK,30,'06-installed-tree.json')
    actual=cmd([str(WORK/'node_modules/.bin/appium'),'--version'],WORK,30,'07-appium-version.log').strip()
    assert actual=='2.19.0','Appium version mismatch'
    proof['appium']=actual
    discovery=cmd([str(WORK/'node_modules/.bin/appium'),'driver','list','--installed','--json'],WORK,30,'08-discovery.json')
    found=json.loads(discovery[discovery.index('{'):])
    assert found.get('xcuitest',{}).get('version')=='9.10.5','XCUITest not discovered at exact version'
    proof['xcuitest']=found['xcuitest']['version']
    cross=WORK/'darwin-dry';cross.mkdir()
    for name in ('package.json','package-lock.json'):shutil.copy2(WORK/name,cross/name)
    cmd(['npm','ci','--ignore-scripts','--include=optional','--no-audit','--no-fund','--os=darwin','--cpu=arm64','--dry-run'],cross,90,'09-darwin-resolution-dry-run.log')
    assert sha(cross/'package-lock.json')==before,'Cross-platform check changed lock'
    for name in ('package.json','package-lock.json'):shutil.copy2(WORK/name,OUT/name)
    proof.update(status='DEPENDENCIES_VERIFIED_LINUX',darwin='RESOLUTION_DRY_RUN_ONLY',hashes={n:sha(OUT/n) for n in ('package.json','package-lock.json')})
except Exception as exc:
    proof.update(status='DEPENDENCY_PREPARATION_FAILED',error=type(exc).__name__+': '+str(exc))
    raise
finally:
    (OUT/'dependency-proof.json').write_text(json.dumps(proof,indent=2))
