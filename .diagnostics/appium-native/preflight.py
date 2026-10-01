"""Validate the entire frozen client and dependency input. No native execution here."""
import ast,hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
registry=json.loads((ROOT/'hashes.json').read_text())
required={'campaign.py','runner.py','test_contract.py','inspect-installed.cjs','smoke.cjs','preflight.py','test_campaign_readiness.py'}
if set(registry)!=required:raise RuntimeError('Incomplete frozen source set')
for name,want in registry.items():
 p=ROOT/name
 if p.is_symlink() or not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=want:raise RuntimeError('Changed input '+name)
 if name.endswith('.py'):ast.parse(p.read_text())
module=ast.parse((ROOT/'campaign.py').read_text())
observer=next(n.value.value for n in module.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='OBSERVE' for t in n.targets))
subprocess.run(['node','--check'],input=('function observe(){\n'+observer+'\n}\n').encode(),check=True,timeout=10)
for name in ('inspect-installed.cjs','smoke.cjs'):subprocess.run(['node','--check',str(ROOT/name)],check=True,timeout=10)
print('FROZEN_CLIENT_VERIFIED '+json.dumps(registry,sort_keys=True))
