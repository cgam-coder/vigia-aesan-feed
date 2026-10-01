#!/usr/bin/env python3
"""Disposable XCTest UI probe for Safari software keyboard, rotation and pinch.
Only public Preview pages; no private code, keys, accounts or runtime downloads.
"""
import importlib.util,json,os,re,signal,subprocess,time,shutil,platform
from pathlib import Path
spec=importlib.util.spec_from_file_location('smoke',Path(__file__).with_name('ios_safari_smoke.py'));smoke=importlib.util.module_from_spec(spec);spec.loader.exec_module(smoke)
OUT=Path('native-ui-evidence');OUT.mkdir(exist_ok=True)
report={'scope':'bounded native XCTest UI probe','physicalIPhone':False,'target':smoke.TARGET,'runId':os.environ.get('GITHUB_RUN_ID'),'diagnosticSha':os.environ.get('GITHUB_SHA'),'stages':[],'screenshots':[],'cases':[],'cleanup':{}}
sim=None
class Deadline(TimeoutError):pass

def persist(): (OUT/'report.json').write_text(json.dumps(report,indent=2))
def cmd(args,limit=20):
 p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,stdin=subprocess.DEVNULL,start_new_session=True)
 try:raw=p.communicate(timeout=limit)[0]
 except BaseException:
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  p.communicate(timeout=3);raise
 return p.returncode,raw.decode(errors='replace')
def require(args,limit=20):
 rc,text=cmd(args,limit)
 if rc:raise RuntimeError('Command failed: '+args[0]+'; '+text[-1800:])
 return text
def mark(name):report['stages'].append(name);report['lastStage']=name;persist();print('NATIVE_UI_STAGE '+name,flush=True)
def alarm(*_):raise Deadline('Independent 480-second deadline')
signal.signal(signal.SIGALRM,alarm);signal.alarm(480)
try:
 if platform.system()!='Darwin' or os.environ.get('GITHUB_REPOSITORY')!='cgam-coder/vigia-aesan-feed':raise RuntimeError('Authorized standard macOS public runner only')
 mark('matching-preinstalled-runtime')
 sdk=require(['xcrun','--sdk','iphonesimulator','--show-sdk-version']).strip()
 inventory=json.loads(require(['xcrun','simctl','list','--json'],75));device,runtime=smoke.choose_device(inventory,sdk)
 report['selected']={'model':device['name'],'runtime':runtime['version'],'build':runtime.get('buildversion'),'xcode':require(['xcodebuild','-version']),'macOS':require(['sw_vers'])}
 sim=require(['xcrun','simctl','create','UI-F1A-XCTest',device['deviceTypeIdentifier'],runtime['identifier']],25).strip()
 if not re.fullmatch('[a-fA-F0-9-]{36}',sim):raise RuntimeError('Invalid simulator identifier')
 report['simulatorUDID']=sim
 mark('boot-own-simulator')
 require(['xcrun','simctl','boot',sim]);require(['xcrun','simctl','bootstatus',sim,'-b'],120)
 require(['defaults','write','com.apple.iphonesimulator','ConnectHardwareKeyboard','-bool','NO'])
 developer=require(['xcode-select','-p']).strip();require(['open','-a',developer+'/Applications/Simulator.app','--args','-CurrentDeviceUDID',sim],15)
 mark('generate-disposable-test-project')
 require(['ruby',str(Path(__file__).with_name('native_ui_project.rb'))],20)
 mark('open-public-preview')
 rc,_=cmd(['xcrun','simctl','openurl',sim,smoke.TARGET],25);report['openUrlAcknowledged']=rc==0
 require(['xcrun','simctl','io',sim,'screenshot',str(OUT/'native-before.png')],20)
 mark('native-ui-test')
 rc,log=cmd(['xcodebuild','test','-project','NativeUI/NativeUI.xcodeproj','-scheme','NativeUI','-destination','platform=iOS Simulator,id='+sim,'-derivedDataPath','native-derived','-resultBundlePath','NativeUI.xcresult','-parallel-testing-enabled','NO','-maximum-test-execution-time-allowance','60','CODE_SIGNING_ALLOWED=NO'],220)
 report['xcodeTestExit']=rc
 report['testLogSummary']=[x[-1200:] for x in log.splitlines() if re.search(r'Test Case .* (passed|failed)|error:|TEST (SUCCEEDED|FAILED)',x)][-12:]
 for case,status in re.findall(r"Test Case '-\[NativeUITests\.NativeUITests (test\w+)\]' (passed|failed)",log):report['cases'].append({'case':case,'status':'PASS' if status=='passed' else 'FAIL'})
 mark('recover-native-captures')
 cmd(['xcrun','simctl','io',sim,'screenshot',str(OUT/'native-after.png')],20)
 if Path('NativeUI.xcresult').exists():
  rc,summary=cmd(['xcrun','xcresulttool','get','test-results','summary','--path','NativeUI.xcresult'],15)
  if not rc:
   j=json.loads(summary);report['summary']={k:j[k] for k in ['result','passedTests','failedTests','skippedTests','totalTestCount'] if k in j}
  rc,_=cmd(['xcrun','xcresulttool','export','attachments','--path','NativeUI.xcresult','--output-path','native-attachments'],20)
  manifest=Path('native-attachments/manifest.json')
  if not rc and manifest.exists():
   def walk(v):
    if isinstance(v,dict):
     yield v
     for x in v.values():yield from walk(x)
    elif isinstance(v,list):
     for x in v:yield from walk(x)
   allowed=['native-ui-dark','native-ui-menu','native-keyboard','native-keyboard-results','native-landscape-bars','native-scroll-bars','native-portrait-bars','native-pinch-zoom']
   for d in walk(json.loads(manifest.read_text())):
    file=d.get('fileName');name=d.get('suggestedHumanReadableName','')
    if not file:continue
    stem=next((n for n in sorted(allowed,key=len,reverse=True) if name.startswith(n)),None)
    source=Path('native-attachments')/Path(file).name
    if stem and source.is_file():
     raw=source.read_bytes()
     try:info=smoke.png_info(raw)
     except RuntimeError:continue
     shutil.copyfile(source,OUT/(stem+'.png'));report['screenshots'].append({'file':stem+'.png',**info})
except Exception as e:report['hold']=type(e).__name__+': '+str(e)[:1800]
finally:
 signal.alarm(0)
 if sim and re.fullmatch('[a-fA-F0-9-]{36}',sim):
  for action in ['shutdown','delete']:
   try:rc,_=cmd(['xcrun','simctl',action,sim],20);report['cleanup'][action]=rc==0
   except Exception:report['cleanup'][action]=False
 persist();print('NATIVE_UI_RESULT '+json.dumps(report),flush=True)
