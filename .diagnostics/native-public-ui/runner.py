"""Bounded public UI tests only. No web inspector, browser profile reads or sync API calls."""
import argparse, hashlib, json, os, re, signal, subprocess, sys, time, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent
REPO='cgam-coder/vigia-aesan-feed'
BRANCH='refs/heads/diag/ui-f1a-ios-simulator-20261001'
CANDIDATE='df5ea1f2918ae232c22e7a31bb0866ab910eb881'
CAP=24_000_000
CASES={
 'core':{'consent-reject':['before','clicked','after-reload'],'theme':['before','selected','after-reload'],
         'menu':['before','open','closed'],'filters':['before','applied','reset','closed'],
         'keyboard':['before','focused','results'],'orientation':['portrait','landscape','restored'],
         'scroll':['before','scrolled','returned'],'pinch':['before','zoomed','restored']},
 'journey':{'consent-accept':['clean-before','clicked','after-reload'],'map':['before','selected'],'detail':['before','opened','back']}}
TEST={'core':'PublicSafariTests/testCoreBlock()','journey':'PublicSafariTests/testJourneyBlock()'}

def digest(b):return hashlib.sha256(b).hexdigest()

def collect(export,out,suite,udid):
    """Preserve exactly the original named attachments, not a workspace export."""
    manifest=export/'manifest.json'
    if not manifest.is_file() or manifest.is_symlink():raise ValueError('missing safe Apple manifest')
    raw=manifest.read_bytes()
    if len(raw)>1_000_000:raise ValueError('manifest too large')
    data=json.loads(raw)
    if not isinstance(data,list) or len(data)!=1 or data[0].get('testIdentifier')!=TEST[suite]:raise ValueError('wrong Apple test context')
    out.mkdir();(out/'manifest.original.json').write_bytes(raw)
    wanted={f'public-ui-{c}-{s}-{kind}':(c,s,kind) for c,stages in CASES[suite].items() for s in stages+['outcome','failure'] for kind in ('state','image')}
    total=len(raw);files=[];states={};seen=set();seenfiles=set();errors=[]
    for item in data[0].get('attachments',[]):
        name=item.get('suggestedHumanReadableName','')
        keys=[k for k in wanted if name==k or name.startswith(k+'_') or name.startswith(k+'.')]
        if not keys:
            if str(name).startswith('public-ui-'):errors.append('unknown test attachment '+name)
            continue
        try:
            if len(keys)!=1 or keys[0] in seen:raise ValueError('ambiguous or duplicate attachment')
            key=keys[0];case,stage,kind=wanted[key]
            a,b=item.get('exportedFileName'),item.get('fileName')
            if a and b and a!=b:raise ValueError('conflicting export names')
            filename=a or b
            if not isinstance(filename,str) or Path(filename).name!=filename or '\\' in filename or filename in ('','.','..'):raise ValueError('unsafe export name')
            if filename in seenfiles:raise ValueError('source file reused')
            p=export/filename
            if p.is_symlink() or not p.is_file() or p.stat().st_size>8_000_000:raise ValueError('missing or oversized original')
            if item.get('deviceId')!=udid:raise ValueError('wrong simulator identity')
            content=p.read_bytes();total+=len(content)
            if total>CAP:raise ValueError('export size ceiling exceeded')
            if kind=='state':
                state=json.loads(content)
                if state.get('case')!=case or state.get('stage')!=stage:raise ValueError('wrong state association')
                states[key]=state
            elif not (content.startswith(b'\x89PNG\r\n\x1a\n') or content.startswith(b'\xff\xd8\xff')):raise ValueError('unexpected image bytes')
            (out/filename).write_bytes(content);seen.add(key);seenfiles.add(filename)
            files.append({'logicalName':key,'file':filename,'sha256':digest(content),'bytes':len(content),'case':case,'stage':stage,'kind':kind,'timestamp':item.get('timestamp')})
        except Exception as e:errors.append(str(e))
    result={'testIdentifier':TEST[suite],'files':files,'states':states,'errors':errors,'visualReview':'PENDING','cases':{}}
    for c,stages in CASES[suite].items():
        required=[f'public-ui-{c}-{s}-{k}' for s in stages for k in ('state','image')]
        outcome=states.get(f'public-ui-{c}-outcome-state',{})
        present=all(k in seen for k in required)
        result['cases'][c]={'evidence':'RECOVERED' if present else 'INCOMPLETE',
          'assertions':outcome.get('actionsAndAssertions','NOT_COMPLETED'),'gate':'HOLD_VISUAL_AND_SCOPE_REVIEW'}
    (out/'index.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    return result

def run(suite):
    assert sys.platform=='darwin' and os.environ.get('GITHUB_REPOSITORY')==REPO
    assert os.environ.get('GITHUB_REF')==BRANCH and os.environ.get('GITHUB_RUN_ATTEMPT')=='1'
    assert os.environ.get('DEVELOPER_DIR')=='/Applications/Xcode_16.4.app/Contents/Developer'
    for name,sha in json.loads((ROOT/'hashes.json').read_text()).items():
        if Path(name).name!=name or digest((ROOT/name).read_bytes())!=sha:raise ValueError('unreviewed input')
    work=Path(os.environ['RUNNER_TEMP'])/('public-ui-'+suite)
    work.mkdir(exist_ok=False);evidence=work/'evidence';evidence.mkdir()
    report={'candidate':CANDIDATE,'suite':suite,'build':'NOT_EXECUTED','nativeTests':'NOT_EXECUTED','cleanup':{},'integrationReady':False,'productGate':'HOLD','limits':['DOM focus return not observed','CSS visualViewport scale not observed','live OS override not observed','stored analytics choice not read']}
    begun=time.monotonic();sim=None;sim_name='NAPublicUI-'+suite+'-'+os.environ['GITHUB_RUN_ID'];keyboard=None
    def save():(evidence/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    def command(args,timeout,log=None):
        dest=evidence/log if log else work/'command.tmp'
        with dest.open('wb') as f:
            p=subprocess.Popen(args,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
            try:code=p.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                os.killpg(p.pid,signal.SIGTERM)
                try:p.wait(timeout=3)
                except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=3)
                raise RuntimeError('command timeout: '+args[0])
        raw=dest.read_text(errors='replace')
        if code!=0:raise RuntimeError('command failed '+args[0]+' code '+str(code))
        return raw
    def limit(n):
        left=440-(time.monotonic()-begun)
        if left<=1:raise RuntimeError('campaign execution deadline')
        return min(left,n)
    try:
        save();command(['ruby',str(ROOT/'project.rb'),str(work/'PublicUI')],limit(10))
        common=['-project',str(work/'PublicUI/PublicUI.xcodeproj'),'-scheme','PublicUI','-derivedDataPath',str(work/'derived'),'CODE_SIGNING_ALLOWED=NO']
        report['build']='STARTED';save()
        command(['xcodebuild','build-for-testing',*common,'-sdk','iphonesimulator','-destination','generic/platform=iOS Simulator'],limit(100),'build.log')
        report['build']='PASS';save()
        sim=command(['xcrun','simctl','create',sim_name,'com.apple.CoreSimulator.SimDeviceType.iPhone-16','com.apple.CoreSimulator.SimRuntime.iOS-18-5'],limit(30)).strip()
        if not re.fullmatch('[A-Fa-f0-9-]{36}',sim):raise ValueError('invalid owned simulator')
        report['simulatorUDID']=sim;save()
        command(['xcrun','simctl','boot',sim],limit(15));command(['xcrun','simctl','bootstatus',sim,'-b'],limit(100))
        command(['xcrun','simctl','ui',sim,'appearance','light'],limit(5))
        report['appearance']=command(['xcrun','simctl','ui',sim,'appearance'],limit(5)).strip()
        try:keyboard=command(['defaults','read','com.apple.iphonesimulator','ConnectHardwareKeyboard'],limit(5)).strip()
        except RuntimeError:keyboard='ABSENT'
        command(['defaults','write','com.apple.iphonesimulator','ConnectHardwareKeyboard','-bool','NO'],limit(5))
        command(['open','-a',os.environ['DEVELOPER_DIR']+'/Applications/Simulator.app','--args','-CurrentDeviceUDID',sim],limit(10))
        report['nativeTests']='STARTED';save()
        command(['xcodebuild','test-without-building',*common,'-destination','platform=iOS Simulator,id='+sim,'-resultBundlePath',str(work/'PublicUI.xcresult'),'-parallel-testing-enabled','NO','-only-testing:PublicSafariTests/'+TEST[suite].replace('()',''),'-test-timeouts-enabled','YES','-maximum-test-execution-time-allowance','330'],limit(330),'test.log')
        report['nativeTests']='COMMAND_COMPLETED'
    except Exception as e:
        report['stop']=str(e)
        if report['build']!='PASS':report['nativeTests']='NOT_EXECUTED_BUILD_BLOCKED'
    finally:
        # Finite export and cleanup reserve before the 10-minute job ceiling.
        bundle=work/'PublicUI.xcresult'
        try:
            if bundle.exists():
                try:
                    raw=command(['xcrun','xcresulttool','get','test-results','tests','--path',str(bundle)],12,'xcresult-tests.json')
                    json.loads(raw)
                except Exception as e:report['metadataError']=str(e)
                command(['xcrun','xcresulttool','export','attachments','--test-id',TEST[suite],'--path',str(bundle),'--output-path',str(work/'export')],30,'export.log')
                report['recovery']=collect(work/'export',evidence/'originals',suite,sim)
                pictures=[str(evidence/'originals'/f['file']) for f in report['recovery']['files'] if f['kind']=='image']
                if pictures:command(['sips','-g','pixelWidth','-g','pixelHeight',*pictures],12,'image-validation.log')
            else:report['recoveryError']='NO_XCRESULT'
        except Exception as e:report['recoveryError']=str(e)
        if not sim:
            try:
                inv=json.loads(command(['xcrun','simctl','list','devices','--json'],5))
                owned=[d for ds in inv.get('devices',{}).values() for d in ds if d.get('name')==sim_name]
                if len(owned)==1:sim=owned[0]['udid']
                elif len(owned)>1:report['cleanup']['ambiguousOwnedResource']=False
            except Exception:report['cleanup']['ownershipLookup']=False
        if keyboard is not None:
            try:
                args=['defaults','delete','com.apple.iphonesimulator','ConnectHardwareKeyboard'] if keyboard=='ABSENT' else ['defaults','write','com.apple.iphonesimulator','ConnectHardwareKeyboard','-bool','YES' if keyboard=='1' else 'NO']
                command(args,5);report['cleanup']['keyboardRestored']=True
            except Exception:report['cleanup']['keyboardRestored']=False
        if sim and re.fullmatch('[A-Fa-f0-9-]{36}',sim):
            for op in ('shutdown','delete'):
                try:command(['xcrun','simctl',op,sim],10);report['cleanup'][op]=True
                except Exception:report['cleanup'][op]=False
        report['cleanupGate']='PASS' if all(report['cleanup'].values()) else 'HOLD'
        recovery=report.get('recovery',{})
        proof=recovery.get('cases',{}).get('consent-reject',{})
        report['integrationReady']=suite=='core' and report['build']=='PASS' and report['nativeTests']=='COMMAND_COMPLETED' and report['cleanupGate']=='PASS' and not recovery.get('errors') and 'recoveryError' not in report and proof.get('evidence')=='RECOVERED' and proof.get('assertions')=='COMPLETED'
        report['elapsedSeconds']=round(time.monotonic()-begun,2);save()
        allowed={'report.json','build.log','test.log','export.log','xcresult-tests.json','image-validation.log'}
        entries=[p for p in evidence.rglob('*') if p.is_file()]
        if any(p.is_symlink() for p in entries):raise ValueError('unsafe artifact')
        if any(p.parent==evidence and p.name not in allowed for p in entries):raise ValueError('unexpected evidence file')
        if sum(p.stat().st_size for p in entries)>CAP:raise ValueError('evidence ceiling')
        with zipfile.ZipFile(work/'evidence.zip','x',zipfile.ZIP_DEFLATED) as z:
            for p in entries:z.write(p,p.relative_to(evidence).as_posix())
        (work/'integrity.json').write_text(json.dumps({'sha256':digest((work/'evidence.zip').read_bytes()),'bytes':(work/'evidence.zip').stat().st_size}))
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('proceed='+str(report['integrationReady']).lower()+'\n')
        print(json.dumps({k:v for k,v in report.items() if k!='recovery'},indent=2))
    return 0 if report['nativeTests']=='COMMAND_COMPLETED' and report['cleanupGate']=='PASS' and 'recoveryError' not in report else 2

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('suite',choices=CASES);a=p.parse_args();sys.exit(run(a.suite))
