#!/usr/bin/env python3
"""Single standard macOS XCTest campaign on the immutable public candidate Preview.
No neutral calibration, no SafariDriver, no product writes, no automatic retries.
"""
import hashlib,importlib.util,json,os,platform,re,signal,subprocess,sys,time
from pathlib import Path
spec=importlib.util.spec_from_file_location('collector',Path(__file__).with_name('recover_product_attachments.py'))
collector=importlib.util.module_from_spec(spec);spec.loader.exec_module(collector)
OUT=Path('product-xctest-evidence');EXECUTION_SECONDS=410
class Deadline(Exception):pass

def main():
 OUT.mkdir(exist_ok=False)
 report={'candidateSha':'df5ea1f2918ae232c22e7a31bb0866ab910eb881','preview':'https://8c4df878-vigia-runtime.c-gamiz93.workers.dev/es/alertas','diagnosticSha':os.environ.get('GITHUB_SHA'),'runId':os.environ.get('GITHUB_RUN_ID'),'runAttempt':os.environ.get('GITHUB_RUN_ATTEMPT'),'physicalIPhone':False,'calibrationRepeated':False,'canonicalCIRepeated':False,'stages':[],'execution':{'status':'UNKNOWN'},'productGate':'HOLD','cleanup':{},'evidence':{},'cases':{}}
 sim=None;old_keyboard=None;tests={};recovery={}
 def persist():(OUT/'report.json').write_text(json.dumps(report,indent=2))
 def mark(stage):report['stages'].append({'stage':stage,'timeMs':int(time.time()*1000)});report['lastStage']=stage;persist();print('PRODUCT_RUN_STAGE '+stage,flush=True)
 def cmd(args,limit=20):
  p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,stdin=subprocess.DEVNULL,start_new_session=True)
  try:a,b=p.communicate(timeout=limit)
  except BaseException:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   a,b=p.communicate(timeout=3);save(args,a,b);raise
  save(args,a,b)
  if p.returncode:raise RuntimeError(args[0]+' returned '+str(p.returncode)+': '+(a+b).decode(errors='replace')[-1500:])
  return a.decode(errors='replace')
 def save(args,a,b):
  if args[0]=='xcodebuild' and args[1] in ('build-for-testing','test-without-building'):(OUT/('build.log' if args[1]=='build-for-testing' else 'test.log')).write_bytes(a+b)
  if args[:3]==['xcrun','xcresulttool','export']:(OUT/'export-output.txt').write_bytes(a+b)
 def alarm(*_):raise Deadline('410-second execution limit; attachment recovery and cleanup reserved')
 signal.signal(signal.SIGALRM,alarm);signal.alarm(EXECUTION_SECONDS)
 try:
  if platform.system()!='Darwin' or os.environ.get('GITHUB_REPOSITORY')!='cgam-coder/vigia-aesan-feed' or os.environ.get('GITHUB_RUN_ATTEMPT')!='1':raise RuntimeError('One owner-authorized standard macOS attempt only')
  mark('validate-known-preinstalled-sdk')
  sdk=cmd(['xcrun','--sdk','iphonesimulator','--show-sdk-version']).strip()
  if sdk!='18.5':raise RuntimeError('SDK mismatch; no downloads or alternative runtime')
  report['host']={'simulatorSDK':sdk,'xcode':cmd(['xcodebuild','-version']),'macOS':cmd(['sw_vers'])}
  mark('generate-product-project-and-build')
  cmd(['ruby',str(Path(__file__).with_name('product_ui_project.rb'))],20)
  cmd(['xcodebuild','build-for-testing','-project','ProductUI/ProductUI.xcodeproj','-scheme','ProductUI','-sdk','iphonesimulator','-destination','generic/platform=iOS Simulator','-derivedDataPath','product-derived','CODE_SIGNING_ALLOWED=NO'],110)
  report['buildSucceeded']=True
  sim=cmd(['xcrun','simctl','create','Product-XCTest-'+os.environ['GITHUB_RUN_ID'],'com.apple.CoreSimulator.SimDeviceType.iPhone-16','com.apple.CoreSimulator.SimRuntime.iOS-18-5'],75).strip()
  if not re.fullmatch('[a-fA-F0-9-]{36}',sim):raise RuntimeError('Invalid disposable simulator UUID')
  report['simulatorUDID']=sim;report['requestedEnvironment']={'model':'iPhone 16 SIMULATED','runtime':'iOS 18.5','runtimeBuild':'22F77 (known calibrated runtime)'}
  mark('boot-own-simulator')
  cmd(['xcrun','simctl','boot',sim],20);cmd(['xcrun','simctl','bootstatus',sim,'-b'],120)
  # OS light is preparation for manual override, not another automatic-theme matrix.
  try:
   cmd(['xcrun','simctl','ui',sim,'appearance','light']);report['osAppearanceBefore']=cmd(['xcrun','simctl','ui',sim,'appearance']).strip()
  except Exception as e:report['osAppearanceHold']=str(e)[:500]
  try:old_keyboard=cmd(['defaults','read','com.apple.iphonesimulator','ConnectHardwareKeyboard']).strip()
  except Exception:old_keyboard='ABSENT'
  cmd(['defaults','write','com.apple.iphonesimulator','ConnectHardwareKeyboard','-bool','NO'])
  report['preparation']={'hardwareKeyboardDisabled':True,'originalPreference':old_keyboard,'productStorageSeeded':False}
  cmd(['open','-a',os.environ['DEVELOPER_DIR']+'/Applications/Simulator.app','--args','-CurrentDeviceUDID',sim],15);time.sleep(5)
  mark('single-product-xctest-command')
  report['testCommandStarted']=True;persist()
  try:
   cmd(['xcodebuild','test-without-building','-project','ProductUI/ProductUI.xcodeproj','-scheme','ProductUI','-destination','platform=iOS Simulator,id='+sim,'-derivedDataPath','product-derived','-resultBundlePath','ProductUI.xcresult','-parallel-testing-enabled','NO','-maximum-test-execution-time-allowance','210','-test-timeouts-enabled','YES','CODE_SIGNING_ALLOWED=NO'],260)
   report['testCommandSucceeded']=True
  except Exception as e:report['testCommandSucceeded']=False;report['testCommandError']=type(e).__name__+': '+str(e)[:1700]
 except Exception as e:report['executionHold']=type(e).__name__+': '+str(e)[:1700]
 finally:
  signal.alarm(0)
  # Bounded recovery is independent of test success and optional summary availability.
  signal.signal(signal.SIGALRM,lambda *_: (_ for _ in ()).throw(Deadline('75-second recovery ceiling')));signal.alarm(75)
  mark('recover-exact-product-testcase')
  try:
   if Path('ProductUI.xcresult').exists():
    try:
     raw=cmd(['xcrun','xcresulttool','get','test-results','tests','--path','ProductUI.xcresult'],10);(OUT/'xcresult-tests.json').write_text(raw);tests=json.loads(raw)
    except Exception as e:report['testsHold']=str(e)[:500]
    # No optional summary call: exact structured case remains authoritative; absence is explicit.
    help_text=cmd(['xcrun','xcresulttool','help','export','attachments'],10);(OUT/'export-help.txt').write_text(help_text)
    if '--test-id' not in help_text:raise ValueError('Installed exporter lacks exact test-id filter')
    cmd(['xcrun','xcresulttool','export','attachments','--test-id',collector.TEST_ID,'--path','ProductUI.xcresult','--output-path','product-attachments'],30)
    export=Path('product-attachments')
    if (export/'manifest.json').is_file():(OUT/'manifest.original.json').write_bytes((export/'manifest.json').read_bytes())
    recovery=collector.recover(export,Path('product-recovered'))
    for filename in ['manifest.original.json','export-inventory.json','product-export-reviewed.zip','recovery-report.json']:
     source=Path('product-recovered')/filename
     if source.exists():(OUT/filename).write_bytes(source.read_bytes())
    for item in recovery.get('copied',[]):
     source=Path('product-recovered')/item['output'];(OUT/item['output']).write_bytes(source.read_bytes())
    report['evidence']={'status':recovery.get('recoveryStatus','HOLD'),'errors':recovery.get('errors',[]),'decodedImages':[],'visualReview':'PENDING'}
    # Decode together in one bounded sips command; leave the original bytes untouched.
    images=[OUT/item['output'] for item in recovery.get('copied',[]) if item['output'].endswith(('.png','.jpg'))]
    if images:
     cmd(['sips','-g','pixelWidth','-g','pixelHeight']+[str(x) for x in images],15)
     report['evidence']['decodedImages']=[x.name for x in images]
    (OUT/'xctest-states.json').write_text(json.dumps(recovery.get('states',[]),indent=2))
   else:report['evidenceHold']='ProductUI.xcresult absent; execution remains independent of evidence'
  except Exception as e:report['evidenceHold']=type(e).__name__+': '+str(e)[:1000]
  finally:signal.alarm(0)
  log=(OUT/'test.log').read_text(errors='replace') if (OUT/'test.log').exists() else ''
  report['execution']=collector.classify_execution(tests,{},log)
  report['cases']=collector.case_results(recovery,report['execution'])
  if sim:
   try:report['osAppearanceAfter']=cmd(['xcrun','simctl','ui',sim,'appearance'],10).strip()
   except Exception as e:report['osAfterHold']=str(e)[:300]
  mark('cleanup-own-simulator-and-preparation')
  if old_keyboard is not None:
   try:
    args=['defaults','delete','com.apple.iphonesimulator','ConnectHardwareKeyboard'] if old_keyboard=='ABSENT' else ['defaults','write','com.apple.iphonesimulator','ConnectHardwareKeyboard','-bool','YES' if old_keyboard=='1' else 'NO']
    cmd(args,10);report['cleanup']['keyboardPreferenceRestored']=True
   except Exception as e:report['cleanup']['keyboardPreferenceRestored']=False;report['cleanup']['keyboardError']=str(e)[:300]
  if sim and re.fullmatch('[a-fA-F0-9-]{36}',sim):
   for action in ['shutdown','delete']:
    try:cmd(['xcrun','simctl',action,sim],20);report['cleanup'][action]=True
    except Exception as e:report['cleanup'][action]=False;report['cleanup'][action+'Error']=str(e)[:500]
  report['cleanup']['gate']='PASS' if all(report['cleanup'].get(k) for k in ('shutdown','delete','keyboardPreferenceRestored')) else 'HOLD'
  integrity=[]
  for path in sorted(OUT.iterdir()):
   if path.is_file() and path.name not in ['report.json','upload-integrity.json']:
    raw=path.read_bytes();integrity.append({'path':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
  (OUT/'upload-integrity.json').write_text(json.dumps({'files':integrity},indent=2));persist();print('PRODUCT_XCTEST_RESULT '+json.dumps(report),flush=True)
 return 0 if report['cleanup']['gate']=='PASS' else 1

if __name__=='__main__':sys.exit(main())
