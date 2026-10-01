#!/usr/bin/env python3
"""Recover only named neutral-XCTest exports. Standard library; no runner or browser.

This is a locally tested proposed collector, NOT proof of historical recovery.
Apple's export manifest must be preserved before calling this module.
The helper produces an evidence gate, never a product/calibration PASS.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile

IMAGES = (
    'neutral-xctest-before', 'neutral-xctest-after', 'neutral-xctest-final',
    'neutral-safari-foreground', 'neutral-navigation-before', 'neutral-navigation-after',
)
STAGES = (
    'test-entered', 'safari-foreground', 'navigation-start', 'fixture-loaded',
    'before-tap', 'tap-call-entered', 'tap-returned', 'after-tap', 'final',
)
NAMES = IMAGES + tuple('neutral-state-' + stage for stage in STAGES)
LIMIT = 10_000_000
TEST_ID = "NeutralUITests/testNeutralTap()"


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def entries(value):
    if isinstance(value, dict):
        if 'suggestedHumanReadableName' in value:
            yield value
        for child in value.values():
            yield from entries(child)
    elif isinstance(value, list):
        for child in value:
            yield from entries(child)


def logical_name(name: str) -> str | None:
    matches = [n for n in NAMES if name == n or name.startswith(n + '_') or name.startswith(n + '.')]
    if len(matches) > 1:
        raise ValueError('Ambiguous attachment name')
    return matches[0] if matches else None


def image_kind(raw: bytes) -> str:
    # Signature checks only; decoded integrity and visual review remain separate gates.
    if raw.startswith(b'\x89PNG\r\n\x1a\n') and len(raw) >= 33 and raw[12:16] == b'IHDR':
        width, height = struct.unpack('>II', raw[16:24])
        if 200 <= width <= 12000 and 200 <= height <= 12000:
            return 'png'
    if len(raw) >= 100 and raw.startswith(b'\xff\xd8\xff') and raw.endswith(b'\xff\xd9'):
        return 'jpg'
    raise ValueError('Not a supported screenshot signature; never rename arbitrary bytes to PNG')


def recover(export_dir: Path, output_dir: Path) -> dict:
    export_dir = export_dir.resolve(strict=True)
    output_dir = output_dir.absolute()
    if output_dir == export_dir or export_dir in output_dir.parents:
        raise ValueError('Output must be separate from original export')
    if output_dir.exists():
        raise FileExistsError('Use a new output directory; existing evidence is never overwritten')
    manifest_path = export_dir / 'manifest.json'
    if manifest_path.is_symlink():raise ValueError('Manifest symlink forbidden')
    raw_manifest = manifest_path.read_bytes()
    if len(raw_manifest) > 1_000_000:
        raise ValueError('Manifest exceeds bounded size')
    manifest = json.loads(raw_manifest)
    objects = list(entries(manifest))
    if len(objects) > 128:
        raise ValueError('Unexpected attachment volume')
    output_dir.mkdir(parents=True)
    (output_dir / 'manifest.original.json').write_bytes(raw_manifest)
    report = {'scope': 'attachment recovery only', 'manifestSha256': sha(raw_manifest),
              'copied': [], 'states': [], 'errors': [], 'ignoredCount': 0,
              'imagePairRecovered': False, 'visualReview': 'PENDING', 'productPass': None}
    seen = set(); seen_files = set()
    total = 0
    groups=manifest if isinstance(manifest,list) else [manifest]
    context_ok=len(groups)==1 and isinstance(groups[0],dict) and groups[0].get('testIdentifier')==TEST_ID and isinstance(groups[0].get('attachments'),list)
    if context_ok and len(objects)!=len(groups[0]['attachments']):report['errors'].append({'error':'Unknown attachment naming schema; records not silently omitted'})
    if not context_ok:report['errors'].append({'error':'Unrecognized manifest/testcase context; expected one neutral testcase'})
    inventory=[]
    for source in sorted(export_dir.iterdir()):
        if source.is_symlink() or not source.is_file():
            report['errors'].append({'error':'Unexpected directory or symlink in export'});continue
        if source.stat().st_size>LIMIT:
            report['errors'].append({'error':'Oversized export file'});continue
        raw=source.read_bytes();inventory.append({'exportedFileName':source.name,'bytes':len(raw),'sha256':sha(raw)})
    (output_dir/'export-inventory.json').write_text(json.dumps(inventory,indent=2))
    for item in objects:
        name = item.get('suggestedHumanReadableName')
        try:
            if not isinstance(name, str):
                raise ValueError('Human-readable name is not a string')
            logical = logical_name(name)
            if logical is None:
                if name.startswith('neutral-'):raise ValueError('Unknown named neutral attachment schema')
                report['ignoredCount'] += 1
                continue
            filename = item.get('exportedFileName')
            legacy = item.get('fileName')
            if filename and legacy and filename != legacy:
                raise ValueError('Conflicting exportedFileName/fileName')
            filename = filename or legacy  # compatibility, always recorded below
            if not isinstance(filename, str) or not filename:
                raise ValueError('Named attachment lacks exportedFileName/fileName; do not silently skip')
            if Path(filename).name != filename or filename in ('.', '..') or '\\' in filename:
                raise ValueError('Unsafe exported filename')
            source = export_dir / filename
            if source.is_symlink() or not source.is_file():
                raise ValueError('Missing file or forbidden symlink')
            if filename in seen_files:raise ValueError('Duplicate exported filename')
            seen_files.add(filename)
            if logical in seen:
                raise ValueError('Duplicate logical attachment; do not choose one or overwrite')
            seen.add(logical)
            if source.stat().st_size > LIMIT:
                raise ValueError('Attachment exceeds bounded size')
            raw = source.read_bytes()
            total += len(raw)
            if total > 20_000_000:
                raise ValueError('Combined evidence exceeds bounded size')
            if logical.startswith('neutral-state-'):
                if len(raw) > 262144:
                    raise ValueError('Oversized JSON state')
                payload = json.loads(raw)
                if not isinstance(payload, dict) or payload.get('stage') != logical.removeprefix('neutral-state-'):
                    raise ValueError('State payload/name mismatch')
                extension = 'json'
                report['states'].append({'logicalName': logical, 'sourceSha256': sha(raw), 'payload': payload})
            else:
                extension = image_kind(raw)
            destination = logical + '.' + extension
            (output_dir / destination).write_bytes(raw)
            report['copied'].append({'logicalName': logical, 'exportedFileName': filename,
                                     'filenameField': 'exportedFileName' if item.get('exportedFileName') else 'fileName',
                                     'output': destination, 'bytes': len(raw), 'sha256': sha(raw)})
        except Exception as exc:
            report['errors'].append({'name': name, 'error': str(exc)})
    report['testIdentifier']=TEST_ID if context_ok else None
    # Bounded original bytes for approved neutral records only; no whole xcresult/workspace.
    if report['copied']:
        with zipfile.ZipFile(output_dir/'neutral-export-reviewed.zip','w',zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('manifest.json',raw_manifest)
            for item in report['copied']:archive.write(export_dir/item['exportedFileName'],item['exportedFileName'])
    indexed = {item['logicalName']: item for item in report['copied']}
    before = indexed.get('neutral-xctest-before')
    after = indexed.get('neutral-xctest-after')
    if before and after and before['sha256'] == after['sha256']:
        report['errors'].append({'error': 'Before/after have identical bytes; neutral transition not visually evidenced'})
    report['imagePairRecovered'] = bool(before and after and not report['errors'])
    report['recoveryStatus'] = 'RECOVERED_PENDING_VISUAL_REVIEW' if report['imagePairRecovered'] else 'HOLD'
    (output_dir / 'recovery-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


def classify_execution(tests,summary,log):
    nodes=[x for x in walk(tests) if x.get('nodeType')=='Test Case']
    exact=[x for x in nodes if x.get('nodeIdentifier')==TEST_ID]
    started="testNeutralTap]' started." in log
    status='UNKNOWN'
    if len(nodes)==1 and len(exact)==1:
        if exact[0].get('result')=='Passed':
            coherent=not summary or (summary.get('totalTestCount')==1 and summary.get('passedTests')==1 and summary.get('failedTests')==0)
            status='EXECUTED_PASSED' if coherent else 'EXECUTED_RESULT_CONFLICT'
        elif exact[0].get('result')=='Failed':status='EXECUTED_NOT_PASSED'
        elif started:status='EXECUTED_RESULT_UNKNOWN'
    elif started:status='EXECUTED_RESULT_UNKNOWN'
    return {'status':status,'xctestStarted':True if status.startswith('EXECUTED') else None,'exactTestIdentifier':TEST_ID,'structuredResultAvailable':bool(exact),'summaryAvailable':bool(summary)}

def walk(value):
    if isinstance(value,dict):
        yield value
        for child in value.values():yield from walk(child)
    elif isinstance(value,list):
        for child in value:yield from walk(child)

def state_gate(report):
    states={x['logicalName']:x['payload'] for x in report.get('states',[])}
    before=states.get('neutral-state-before-tap',{});after=states.get('neutral-state-after-tap',{})
    return all(before.get(k) is True for k in ['xctestStarted','safariForeground','fixtureLoaded','targetHittable']) and before.get('counterBefore')==0 and before.get('tapAttempted') is False and after.get('tapAttempted') is True and after.get('tapReturned') is True and after.get('counterAfter')==1 and isinstance(before.get('dateMs'),int) and isinstance(after.get('dateMs'),int) and before['dateMs']<after['dateMs'] and before.get('testIdentifier')==TEST_ID and after.get('testIdentifier')==TEST_ID


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export_dir', type=Path)
    parser.add_argument('output_dir', type=Path)
    args = parser.parse_args()
    result = recover(args.export_dir, args.output_dir)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result['imagePairRecovered'] else 2)
