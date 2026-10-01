#!/usr/bin/env python3
"""One native XCTest tap on a localhost HTML control, without any SafariDriver process.
Conditional fallback specifically authorized after fresh-session WebDriver control failed.
"""
import importlib.util,json,os,platform,re,signal,subprocess,sys,threading,time,urllib.request,tempfile
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
spec=importlib.util.spec_from_file_location('isolation',Path(__file__).with_name('native_input_theme.py'))
isolation=importlib.util.module_from_spec(spec);spec.loader.exec_module(isolation)
OUT=Path('neutral-xctest-evidence')
Deadline=isolation.Deadline

def main():
 OUT.mkdir(exist_ok=True)
 r={'scope':'one XCUIElement tap on neutral local control; no product interaction yet','diagnosticSha':os.environ.get('GITHUB_SHA'),'runId':os.environ.get('GITHUB_RUN_ID'),'candidateSha':'df5ea1f2918ae232c22e7a31bb0866ab910eb881','nativeInputVerified':False,'productPass':None,'physicalIPhone':False,'safariDriverStarted':False,'stages':[],'telemetry':[],'fixtureRequests':[],'cleanup':{},'control':{'projectGenerated':False,'buildStarted':False,'buildSucceeded':False,'xctestStarted':False,'safariForeground':False,'fixtureLoaded':False,'tapAttempted':False,'counterBefore':None,'counterAfter':None,'trustedActivationObserved':False,'inputGate':'HOLD/NOT_EXECUTED'}}
 sim=None;server=None
 def persist():(OUT/'report.json').write_text(json.dumps(r,indent=2))
 def mark(s):r['lastStage']=s;r['stages'].append({'stage':s,'time':time.time()});persist();print('NEUTRAL_XCTEST_STAGE '+s,flush=True)
 def cmd(args,limit=20):
  p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,stdin=subprocess.DEVNULL,start_new_session=True)
  try:a,b=p.communicate(timeout=limit)
  except BaseException:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   try:
    a,b=p.communicate(timeout=3)
    save_log(args,a,b)
   except subprocess.TimeoutExpired:pass
   raise
  save_log(args,a,b)
  if p.returncode:
   summary='\n'.join(x for x in a.decode(errors='replace').splitlines() if re.search('error:|Test Case|TEST (SUCCEEDED|FAILED)|NEUTRAL_',x))[-1600:]
   raise RuntimeError(args[0]+' failed: '+b.decode(errors='replace')[-900:]+'\n'+summary)
  return a.decode(errors='replace')
 def save_log(args,a,b):
  if args[0]=='xcodebuild' and args[1] in ['build-for-testing','test-without-building']:
   (OUT/('build.log' if args[1]=='build-for-testing' else 'test.log')).write_bytes(a+b)
 def alarm(*_):raise Deadline('Independent 480-second single-tap XCTest deadline')
 signal.signal(signal.SIGALRM,alarm);signal.alarm(480)
 try:
  if platform.system()!='Darwin' or os.environ.get('GITHUB_REPOSITORY')!='cgam-coder/vigia-aesan-feed':raise RuntimeError('Authorized public standard macOS runner only')
  mark('direct-preinstalled-simulator-create-without-inventory')
  sdk=cmd(['xcrun','--sdk','iphonesimulator','--show-sdk-version'],20).strip()
  if sdk!='18.5':raise RuntimeError('Preinstalled Xcode16.4/iOS18.5 contract mismatch; no downloads')
  # Availability already proven by the completed isolation run; avoid another cold inventory query.
  # Creating a requested concrete identifier validates it; a mismatch fails rather than choosing another runtime.
  device_id='com.apple.CoreSimulator.SimDeviceType.iPhone-16'
  runtime_id='com.apple.CoreSimulator.SimRuntime.iOS-18-5'
  r['requestedEnvironment']={'model':'iPhone 16','runtime':'iOS 18.5','deviceTypeIdentifier':device_id,'runtimeIdentifier':runtime_id,'runtimeBuild':'not queried in this microtest'}
  r['host']={'simulatorSDK':sdk,'xcode':cmd(['xcodebuild','-version']),'macOS':cmd(['sw_vers'])}
  mark('generate-and-build-before-navigation')
  if not isolation.build_xctest(cmd,OUT,r['control']):raise RuntimeError('build_failed; no test or tap attempted')
  persist()
  sim=cmd(['xcrun','simctl','create','Neutral-XCTest-'+os.environ.get('GITHUB_RUN_ID','local'),device_id,runtime_id],75).strip()
  if not re.fullmatch('[a-fA-F0-9-]{36}',sim):raise RuntimeError('Invalid disposable simulator ID')
  r['simulatorUDID']=sim
  mark('boot-own-simulator');cmd(['xcrun','simctl','boot',sim],20);cmd(['xcrun','simctl','bootstatus',sim,'-b'],120)
  developer=cmd(['xcode-select','-p']).strip();cmd(['open','-a',developer+'/Applications/Simulator.app','--args','-CurrentDeviceUDID',sim],15);time.sleep(5)
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*_):pass
   def do_GET(self):
    if not self.path.startswith('/control'):self.send_error(404);return
    r['fixtureRequests'].append({'time':time.time(),'path':self.path,'userAgent':self.headers.get('User-Agent',''),'hostCheck':self.headers.get('X-Neutral-Host-Check')=='1'})
    raw=isolation.FIXTURE.encode();self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
   def do_POST(self):
    if self.path!='/observe':self.send_error(404);return
    n=int(self.headers.get('Content-Length','0'))
    if n>20000:self.send_error(413);return
    r['telemetry'].append({'time':time.time(),'data':json.loads(self.rfile.read(n))});self.send_response(204);self.end_headers()
  server=ThreadingHTTPServer(('127.0.0.1',8765),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
  req=urllib.request.Request('http://127.0.0.1:8765/control?route=host-check',headers={'X-Neutral-Host-Check':'1'})
  with urllib.request.urlopen(req,timeout=5) as response:r['fixtureHostAvailable']=response.status==200 and b'Neutral activation' in response.read()
  if not r['fixtureHostAvailable']:raise RuntimeError('Host fixture availability failed')
  mark('single-tap-xctest-no-webdriver')
  isolation.run_xctest(sim,cmd,OUT,r['control'])
  time.sleep(1)
  finish_gate(r)
 except Exception as e:r['hold']=type(e).__name__+': '+str(e)[:1700]
 finally:
  signal.alarm(0)
  if sim:
   try:cmd(['xcrun','simctl','io',sim,'screenshot',str(OUT/'final-native.png')],20)
   except Exception as e:r['finalCaptureHold']=str(e)[:500]
  if server:server.shutdown();server.server_close();r['cleanup']['localServer']=True
  if sim and re.fullmatch('[a-fA-F0-9-]{36}',sim):
   for action in ['shutdown','delete']:
    try:cmd(['xcrun','simctl',action,sim],25);r['cleanup'][action]=True
    except Exception as e:r['cleanup'][action]=False;r['cleanup'][action+'Error']=str(e)[:500]
  finish_gate(r);persist();print('NEUTRAL_XCTEST_RESULT '+json.dumps(r),flush=True)
 return 0 if r['cleanup'].get('shutdown') and r['cleanup'].get('delete') else 1

def finish_gate(r):
 c=r['control']
 delivered=False
 for packet in r.get('telemetry',[]):
  d=packet['data'];events=d.get('inputLedger',[])
  click=[x for x in events if x.get('type')=='click' and x.get('trusted') is True and x.get('target')=='neutral']
  completed=any(x.get('type') in ['pointerup','touchend','mouseup'] and x.get('trusted') is True and x.get('target')=='neutral' for x in events)
  if d.get('activations')==1 and len(click)==1 and completed:delivered=True
 c['trustedActivationObserved']=delivered
 c['safariFixtureRequestObserved']=any(not x.get('hostCheck') and 'Safari' in x.get('userAgent','') for x in r.get('fixtureRequests',[]))
 clean=all(r.get('cleanup',{}).get(k) for k in ['localServer','shutdown','delete'])
 r['nativeInputVerified']=bool(c.get('controlVerified') and delivered and c['safariFixtureRequestObserved'] and clean)
 c['inputGate']='PASS_PENDING_VISUAL_REVIEW' if r['nativeInputVerified'] else ('HOLD' if c.get('tapAttempted') else 'HOLD/NOT_EXECUTED')

def self_test():
 isolation.self_test()
 from unittest.mock import patch
 def run(commands,fail=None):
  r={}
  def fake(args,limit=20):
   commands.append(args)
   if fail and fail(args):raise TimeoutError('bounded command double')
   return ''
  return r,fake
 calls=[];r,fake=run(calls,lambda a:a[0]=='xcodebuild')
 assert not isolation.build_xctest(fake,Path('.'),r)
 assert r['blockedStage']=='build_failed' and r['buildStarted'] and not r['buildSucceeded']
 isolation.run_xctest('fake',fake,Path('.'),r)
 assert not any('test-without-building' in a for a in calls)
 with tempfile.TemporaryDirectory() as root:
  out=Path(root);before=out/'neutral-xctest-before.png';before.write_bytes(b'preserved')
  r={'buildSucceeded':True};calls=[]
  def timeout(args,limit=20):
   calls.append(args)
   if 'test-without-building' in args:raise TimeoutError('native navigation timeout double')
   return ''
  with patch.object(isolation.Path,'exists',return_value=False):isolation.run_xctest('fake',timeout,out,r)
  assert before.read_bytes()==b'preserved' and r['testCommandStarted'] and not r['xctestStarted']
  assert r['blockedStage']=='test_not_entered' and not r['controlVerified']
  assert not any('openurl' in a for a in calls)
 base={'control':{'controlVerified':True,'tapAttempted':True},'telemetry':[],'fixtureRequests':[], 'cleanup':{'localServer':True,'shutdown':True,'delete':True}}
 finish_gate(base);assert not base['nativeInputVerified']
 base['fixtureRequests']=[{'userAgent':'Mobile Safari','hostCheck':False}]
 ledger=[{'type':'pointerup','trusted':True,'target':'neutral'},{'type':'click','trusted':False,'target':'neutral'}]
 base['telemetry']=[{'data':{'activations':1,'inputLedger':ledger}}]
 finish_gate(base);assert not base['nativeInputVerified']
 ledger[1]['trusted']=True
 base['telemetry'][0]['data']['activations']=0;finish_gate(base);assert not base['nativeInputVerified']
 base['telemetry'][0]['data']['activations']=1;finish_gate(base);assert base['nativeInputVerified']
 base['cleanup']['delete']=False;finish_gate(base);assert not base['nativeInputVerified']
 source=Path(__file__).with_name('neutral_xctest_project.rb').read_text()
 assert 'runnable=' not in source and source.count('button.tap()')==1 and 'runningForeground' in source
 print('XCTEST_ORCHESTRATION_DOUBLES_PASS: build stop, navigation timeout, untouched evidence, execution/trusted/cleanup gates')

if __name__=='__main__':
 if sys.argv[1:]==['--self-test']:self_test()
 else:sys.exit(main())
