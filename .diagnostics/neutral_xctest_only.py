#!/usr/bin/env python3
"""One native XCTest tap on a localhost HTML control, without any SafariDriver process.
Conditional fallback specifically authorized after fresh-session WebDriver control failed.
"""
import importlib.util,json,os,platform,re,signal,subprocess,sys,threading,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
spec=importlib.util.spec_from_file_location('isolation',Path(__file__).with_name('native_input_theme.py'))
isolation=importlib.util.module_from_spec(spec);spec.loader.exec_module(isolation)
OUT=Path('neutral-xctest-evidence')
Deadline=isolation.Deadline

def main():
 OUT.mkdir(exist_ok=True)
 r={'scope':'one XCUIElement tap on neutral local control; no product interaction yet','diagnosticSha':os.environ.get('GITHUB_SHA'),'runId':os.environ.get('GITHUB_RUN_ID'),'candidateSha':'df5ea1f2918ae232c22e7a31bb0866ab910eb881','nativeInputVerified':False,'productPass':None,'physicalIPhone':False,'safariDriverStarted':False,'stages':[],'telemetry':[],'cleanup':{}}
 sim=None;server=None
 def persist():(OUT/'report.json').write_text(json.dumps(r,indent=2))
 def mark(s):r['lastStage']=s;r['stages'].append({'stage':s,'time':time.time()});persist();print('NEUTRAL_XCTEST_STAGE '+s,flush=True)
 def cmd(args,limit=20):
  p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,stdin=subprocess.DEVNULL,start_new_session=True)
  try:a,b=p.communicate(timeout=limit)
  except BaseException:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   try:p.communicate(timeout=3)
   except subprocess.TimeoutExpired:pass
   raise
  if p.returncode:
   summary='\n'.join(x for x in a.decode(errors='replace').splitlines() if re.search('error:|Test Case|TEST (SUCCEEDED|FAILED)|NEUTRAL_',x))[-1600:]
   raise RuntimeError(args[0]+' failed: '+b.decode(errors='replace')[-900:]+'\n'+summary)
  return a.decode(errors='replace')
 def alarm(*_):raise Deadline('Independent 420-second single-tap XCTest deadline')
 signal.signal(signal.SIGALRM,alarm);signal.alarm(420)
 try:
  if platform.system()!='Darwin' or os.environ.get('GITHUB_REPOSITORY')!='cgam-coder/vigia-aesan-feed':raise RuntimeError('Authorized public standard macOS runner only')
  mark('targeted-preinstalled-runtime-inventory')
  sdk=cmd(['xcrun','--sdk','iphonesimulator','--show-sdk-version'],20).strip()
  if sdk!='18.5':raise RuntimeError('Preinstalled Xcode16.4/iOS18.5 contract mismatch; no downloads')
  runtimes=json.loads(cmd(['xcrun','simctl','list','runtimes','--json'],40))['runtimes']
  devices=json.loads(cmd(['xcrun','simctl','list','devicetypes','--json'],40))['devicetypes']
  runtime=next(x for x in runtimes if x.get('isAvailable') and x.get('version')=='18.5' and '.iOS-' in x.get('identifier',''))
  device=next(x for x in devices if x.get('name')=='iPhone 16')
  r['environment']={'model':device['name'],'iOS':runtime['version'],'build':runtime.get('buildversion'),'xcode':cmd(['xcodebuild','-version']),'macOS':cmd(['sw_vers'])}
  sim=cmd(['xcrun','simctl','create','Neutral-XCTest-'+os.environ.get('GITHUB_RUN_ID','local'),device['identifier'],runtime['identifier']],45).strip()
  if not re.fullmatch('[a-fA-F0-9-]{36}',sim):raise RuntimeError('Invalid disposable simulator ID')
  r['simulatorUDID']=sim
  mark('boot-own-simulator');cmd(['xcrun','simctl','boot',sim],20);cmd(['xcrun','simctl','bootstatus',sim,'-b'],120)
  developer=cmd(['xcode-select','-p']).strip();cmd(['open','-a',developer+'/Applications/Simulator.app','--args','-CurrentDeviceUDID',sim],15);time.sleep(5)
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*_):pass
   def do_GET(self):
    if not self.path.startswith('/control'):self.send_error(404);return
    raw=isolation.FIXTURE.encode();self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
   def do_POST(self):
    if self.path!='/observe':self.send_error(404);return
    n=int(self.headers.get('Content-Length','0'))
    if n>20000:self.send_error(413);return
    r['telemetry'].append({'time':time.time(),'data':json.loads(self.rfile.read(n))});self.send_response(204);self.end_headers()
  server=ThreadingHTTPServer(('127.0.0.1',8765),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
  mark('single-tap-xctest-no-webdriver')
  r['control']=isolation.run_xctest(sim,cmd,OUT)
  time.sleep(1)
  delivered=any(isolation.classify_input({'count':x['data'].get('activations',0),'ledger':x['data'].get('inputLedger',[])})=='PASS' for x in r['telemetry'])
  r['serverObservedTrustedActivation']=delivered
  r['nativeInputVerified']=r['control'].get('controlVerified',False) and delivered
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
  persist();print('NEUTRAL_XCTEST_RESULT '+json.dumps(r),flush=True)
 return 0 if r['cleanup'].get('shutdown') and r['cleanup'].get('delete') else 1

if __name__=='__main__':
 if sys.argv[1:]==['--self-test']:
  isolation.self_test();assert 'runnable=' not in Path(__file__).with_name('neutral_xctest_project.rb').read_text();assert '.tap()' in Path(__file__).with_name('neutral_xctest_project.rb').read_text();print('XCTEST_MICRO_SELF_TEST_PASS')
 else:sys.exit(main())
