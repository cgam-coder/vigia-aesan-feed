"""Frozen client validation; optional dependency resolution on a public Ubuntu preflight."""
import ast,hashlib,json,os,re,shutil,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def verify():
    registry=json.loads((ROOT/'hashes.json').read_text())
    if set(registry)!=set(['campaign.py','runner.py','test_contract.py','package.json','preflight.py']):raise RuntimeError('Incomplete frozen source registry')
    for name,want in registry.items():
        p=ROOT/name
        if p.is_symlink() or hashlib.sha256(p.read_bytes()).hexdigest()!=want:raise RuntimeError('Changed source '+name)
        if name.endswith('.py'):ast.parse(p.read_text())
    p=json.loads((ROOT/'package.json').read_text())
    if p['dependencies']!={'appium':'2.19.0','appium-xcuitest-driver':'9.10.5'}:raise RuntimeError('Unreviewed framework versions')
    print('FROZEN_APPIUM_SOURCES '+json.dumps(registry,sort_keys=True))

def resolve():
    work=Path(os.environ['RUNNER_TEMP'])/'appium-lock';work.mkdir(exist_ok=False)
    shutil.copy2(ROOT/'package.json',work/'package.json')
    subprocess.run(['npm','install','--ignore-scripts','--no-audit','--no-fund'],cwd=work,check=True,timeout=210)
    lock=work/'package-lock.json';data=json.loads(lock.read_text())
    if lock.stat().st_size>3_000_000:raise RuntimeError('Oversized dependency lock')
    for name,pkg in data['packages'].items():
        if not name:continue
        if not pkg.get('resolved','').startswith('https://registry.npmjs.org/') or not pkg.get('integrity','').startswith('sha512-'):raise RuntimeError('Dependency outside reviewed registry/integrity scope: '+name)
    actual=json.loads(subprocess.check_output(['npm','ls','--depth=0','--json'],cwd=work,timeout=20))
    expected=json.loads((ROOT/'package.json').read_text())['dependencies']
    if any(actual.get('dependencies',{}).get(k,{}).get('version')!=v for k,v in expected.items()):raise RuntimeError('Resolved framework mismatch')
    digest=hashlib.sha256(lock.read_bytes()).hexdigest()
    (work/'lock-integrity.json').write_text(json.dumps({'sha256':digest,'bytes':lock.stat().st_size,'versions':expected}))
    print('DEPENDENCY_LOCK '+digest)

if __name__=='__main__':
    verify()
    if sys.argv[1:]==['resolve']:resolve()
    elif sys.argv[1:]:raise SystemExit('Unknown preflight mode')
