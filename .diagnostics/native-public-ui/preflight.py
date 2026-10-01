"""Exact public native harness inputs; no network or simulator creation."""
import hashlib,json,py_compile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
expected=json.loads((ROOT/'hashes.json').read_text())
for name,sha in expected.items():
    p=ROOT/name
    assert p.parent==ROOT and not p.is_symlink() and p.is_file(),name
    assert hashlib.sha256(p.read_bytes()).hexdigest()==sha,'Unreviewed file '+name
for name in ('runner.py','test_runner.py','lifecycle.py','test_lifecycle.py'):
    py_compile.compile(str(ROOT/name),doraise=True)
s=(ROOT/'PublicSafariTests.swift').read_text()
for forbidden in ('URLSession','dataTask','evaluateJavaScript','localStorage','WebSocket','NSStringFromCGRect'):
    assert forbidden not in s,forbidden
assert s.count('func testCoreBlock()')==1
assert s.count('func testJourneyBlock()')==1
assert 'https://8c4df878-vigia-runtime.c-gamiz93.workers.dev' in s
print('EXACT_PREFLIGHT_INPUTS '+json.dumps(expected,sort_keys=True))
