#!/usr/bin/env python3
"""Bounded, independent Apple Simulator input calibration and OS/media/UI observation.
Public Preview and localhost neutral fixture only. Never a full product PASS.
"""
from __future__ import annotations
import base64, hashlib, importlib.util, json, os, platform, re, signal, subprocess, sys, threading, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('smoke',Path(__file__).with_name('ios_safari_smoke.py'))
SMOKE=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(SMOKE)
TARGET='https://8c4df878-vigia-runtime.c-gamiz93.workers.dev/es/alertas'
OUT=Path('native-isolation-evidence')
EVENT_TYPES=['pointerdown','pointerup','pointercancel','mousedown','mouseup','click','touchstart','touchend','touchcancel']
FIXTURE='''<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neutral input control</title><style>body{font:20px system-ui;padding:20px}button{font:24px system-ui;padding:24px;margin-top:60px}pre{font-size:12px;white-space:pre-wrap}</style><h1>Neutral input control</h1><button id="neutral">Neutral activation</button><p id="counter">Activations: 0</p><pre id="events"></pre><script>window.inputLedger=[];window.activations=0;for(const type of EVENTS)document.addEventListener(type,e=>{const t=e.touches?.[0]||e.changedTouches?.[0]||e;inputLedger.push({type:e.type,timeStamp:e.timeStamp,date:Date.now(),pointerId:e.pointerId??null,pointerType:e.pointerType??null,buttons:e.buttons??null,trusted:e.isTrusted,target:e.target.id||e.target.tagName,x:t.clientX??null,y:t.clientY??null,defaultPrevented:e.defaultPrevented});document.querySelector('#events').textContent=JSON.stringify(inputLedger);fetch('/observe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activations,inputLedger})}).catch(()=>{});},true);document.querySelector('#neutral').addEventListener('click',()=>{activations++;document.querySelector('#counter').textContent='Activations: '+activations;fetch('/observe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activations,inputLedger})}).catch(()=>{});});</script></html>'''.replace('EVENTS',json.dumps(EVENT_TYPES))
MEDIA_INSTALL="""if(!window.__mediaObservation){const m=matchMedia('(prefers-color-scheme: dark)');window.__mediaObservation={events:[],installedAt:Date.now()};m.addEventListener('change',e=>window.__mediaObservation.events.push({dark:e.matches,timeStamp:e.timeStamp,date:Date.now()}));}return true;"""
MEDIA_SNAPSHOT="""const q=s=>document.querySelector(s),c=e=>e?{background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}:null;return {date:Date.now(),url:location.href,mediaDark:matchMedia('(prefers-color-scheme: dark)').matches,mediaEvents:window.__mediaObservation?.events||[],visibility:document.visibilityState,readyState:document.readyState,clientEffectEvidence:{consentMounted:!!q('[role=dialog]'),consentHeading:q('#na-consent-title')?.textContent,buttonTheme:q('.na-theme-toggle')?.getAttribute('data-theme')},stored:localStorage.getItem('nagamealert-theme'),theme:document.documentElement.getAttribute('data-na-theme'),colors:{root:c(document.documentElement),body:c(document.body),header:c(q('.na-public-header'))},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport?.scale}};"""

class Deadline(TimeoutError):pass

def classify_theme(state,expected):
    osmode=state.get('osAppearance','').strip().lower()
    j=state.get('page',{})
    if osmode!=expected:return 'HOLD','OS appearance not confirmed'
    if j.get('stored') is not None:return 'HOLD','Manual preference unexpectedly present'
    if j.get('mediaDark')!=(expected=='dark'):return 'HOLD','OS to media delivery mismatch'
    if not j.get('clientEffectEvidence',{}).get('consentMounted'):return 'HOLD','Client effects not yet independently observed'
    if j.get('theme')!=expected or j.get('clientEffectEvidence',{}).get('buttonTheme')!=expected:return 'FAIL','Media and client ready but UI theme mismatch'
    return 'PASS','OS/media/client/UI agree; screenshot still requires review'

def classify_input(s):
    ledger=s.get('ledger',[])
    if s.get('count',0)>=1 and any(e.get('type')=='click' and e.get('trusted') and e.get('target')=='neutral' for e in ledger):return 'PASS'
    return 'HOLD'

def self_test():
    state={'osAppearance':'dark','page':{'stored':None,'mediaDark':True,'theme':'dark','clientEffectEvidence':{'consentMounted':True,'buttonTheme':'dark'}}}
    assert classify_theme(state,'dark')[0]=='PASS'
    state['page']['mediaDark']=False;assert classify_theme(state,'dark')[0]=='HOLD'
    state['page']['mediaDark']=True;state['page']['theme']='light';assert classify_theme(state,'dark')[0]=='FAIL'
    state['page']['clientEffectEvidence']['consentMounted']=False;assert classify_theme(state,'dark')[0]=='HOLD'
    assert classify_input({'count':0,'ledger':[{'type':'pointerdown','trusted':True,'target':'neutral'}]})=='HOLD'
    assert classify_input({'count':1,'ledger':[{'type':'click','trusted':False,'target':'neutral'}]})=='HOLD'
    assert classify_input({'count':1,'ledger':[{'type':'click','trusted':True,'target':'neutral'}]})=='PASS'
    assert 'onClick' not in FIXTURE and 'React' not in FIXTURE and '<button' in FIXTURE
    SMOKE.self_test();print('ISOLATION_SELF_TEST_PASS: OS/media/client distinction and trusted activation requirement')

def main():
    OUT.mkdir(exist_ok=True)
    r={'target':TARGET,'candidateSha':'df5ea1f2918ae232c22e7a31bb0866ab910eb881','diagnosticSha':os.environ.get('GITHUB_SHA'),'runId':os.environ.get('GITHUB_RUN_ID'),'physicalIPhone':False,'productPass':None,'fullCompatibilityCertified':False,'theme':[],'input':[],'screenshots':[],'cleanup':{},'stages':[],'fixtureTelemetry':[]}
    sim=None;driver=None;session=None;server=None;stage='start';started=time.monotonic()
    def persist():
        t=OUT/'report.tmp';t.write_text(json.dumps(r,indent=2));t.replace(OUT/'report.json')
    def mark(s):
        nonlocal stage
        stage=s;r['stages'].append({'stage':s,'time':time.time()});persist();print('ISOLATION_STAGE '+s,flush=True)
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
    def attempt(fn):
        try:return {'ok':True,'value':fn()}
        except Deadline:raise
        except Exception as e:return {'ok':False,'error':type(e).__name__+': '+str(e)[:1200]}
    def wd(method,path,payload=None,limit=20):
        data=None if payload is None else json.dumps(payload).encode()
        req=urllib.request.Request('http://127.0.0.1:4444'+path,data=data,method=method,headers={'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=limit) as response:result=json.load(response)
        except urllib.error.HTTPError as e:raise RuntimeError('WebDriver HTTP'+str(e.code)+': '+e.read(1600).decode(errors='replace'))
        v=result.get('value')
        if isinstance(v,dict) and v.get('error'):raise RuntimeError('WebDriver '+str(v)[:1200])
        return v
    def js(source):return wd('POST','/session/'+session+'/execute/sync',{'script':source,'args':[]},12)
    def image(name,native=False):
        result={'file':name+'.png','stage':stage,'nativeFramebuffer':native}
        try:
            if native:cmd(['xcrun','simctl','io',sim,'screenshot',str(OUT/(name+'.png'))],20);raw=(OUT/(name+'.png')).read_bytes()
            else:raw=base64.b64decode(wd('GET','/session/'+session+'/screenshot',limit=15));(OUT/(name+'.png')).write_bytes(raw)
            result.update(SMOKE.png_info(raw));result['ok']=True
        except Deadline:raise
        except Exception as e:result.update(ok=False,error=str(e)[:1000])
        r['screenshots'].append(result);persist();return result.get('ok',False)
    def new_session():
        nonlocal session
        value=wd('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'safari','platformName':'ios','safari:useSimulator':True,'safari:deviceUDID':sim}}},45)
        session=value['sessionId'];r.setdefault('sessions',[]).append({'id':session,'caps':{k:v for k,v in value.get('capabilities',{}).items() if k in ['browserName','browserVersion','platformName','safari:platformVersion','safari:platformBuildVersion']}})
        wd('POST','/session/'+session+'/timeouts',{'pageLoad':30000,'script':12000,'implicit':0})
        return '/session/'+session
    def close_session():
        nonlocal session
        if session:
            sid=session
            r['cleanup']['releaseActions-'+sid]=attempt(lambda:wd('DELETE','/session/'+sid+'/actions',limit=10))
            r['cleanup']['session-'+sid]=attempt(lambda:wd('DELETE','/session/'+sid,limit=10))
            session=None;persist()
    def theme_observation(label):
        osmode=cmd(['xcrun','simctl','ui',sim,'appearance'],10).strip()
        snapshot={'label':label,'observedAt':time.time(),'osAppearance':osmode,'page':js(MEDIA_SNAPSHOT)}
        return snapshot
    def observe_theme_case(label,expected,navigate=False):
        mark(label)
        cmd(['xcrun','simctl','ui',sim,'appearance',expected],15)
        if navigate:wd('POST','/session/'+session+'/url',{'url':TARGET},35)
        js(MEDIA_INSTALL)
        case={'case':label,'expected':expected,'observations':[]}
        end=time.monotonic()+15
        while time.monotonic()<end:
            state=theme_observation(label);case['observations'].append(state)
            status,reason=classify_theme(state,expected)
            if status=='PASS':break
            time.sleep(2)
        case['finalObservation']=theme_observation(label+'-final')
        case['status'],case['reason']=classify_theme(case['finalObservation'],expected)
        case['capture']=image(label);case['nativeCapture']=image(label+'-native',True)
        if not case['capture'] or not case['nativeCapture']:case.update(status='HOLD',reason='Mandatory screenshot missing')
        r['theme'].append(case);persist()
    def input_snapshot():return js("const e=document.querySelector('#neutral'),q=e.getBoundingClientRect();return {count:window.activations,visibleCounter:document.querySelector('#counter').textContent,ledger:window.inputLedger,rect:{left:q.left,top:q.top,right:q.right,bottom:q.bottom,width:q.width,height:q.height},hit:document.elementFromPoint(q.left+q.width/2,q.top+q.height/2)?.id,viewport:{width:innerWidth,height:innerHeight,scale:visualViewport.scale}};")
    def calibrate(route):
        mark('neutral-'+route)
        case={'case':'neutral-'+route,'status':'HOLD','freshSession':True,'observations':[]}
        try:
            base=new_session();case['sessionId']=session
            wd('POST',base+'/url',{'url':'http://127.0.0.1:8765/control?route='+route},30)
            before=input_snapshot();case['before']=before;case['beforeCapture']=image('neutral-'+route+'-before');case['beforeNativeCapture']=image('neutral-'+route+'-before-native',True)
            if before['count']!=0 or before['ledger']:raise RuntimeError('Fixture input state is not clean')
            if before['hit']!='neutral':raise RuntimeError('Measured target not hittable')
            found=wd('POST',base+'/element',{'using':'css selector','value':'#neutral'})
            if route=='element':case['command']=attempt(lambda:wd('POST',base+'/element/'+found['element-6066-11e4-a52e-4f735466cecf']+'/click',{}))
            else:
                q=before['rect'];x=round(q['left']+q['width']/2);y=round(q['top']+q['height']/2)
                actions=[{'type':'pointerMove','duration':100,'origin':'viewport','x':x,'y':y},{'type':'pointerDown','button':0},{'type':'pause','duration':80},{'type':'pointerUp','button':0}]
                case['command']=attempt(lambda:wd('POST',base+'/actions',{'actions':[{'type':'pointer','id':'clean-touch','parameters':{'pointerType':'touch'},'actions':actions}]}))
            # Observe the FULL bounded window, including late release/click/cancel delivery.
            end=time.monotonic()+8
            while time.monotonic()<end:case['observations'].append(input_snapshot());time.sleep(1)
            case['beforeRelease']=input_snapshot()
            case['releaseActions']=attempt(lambda:wd('DELETE',base+'/actions',limit=10))
            time.sleep(1);case['finalAfterRelease']=input_snapshot()
            case['status']=classify_input(case['beforeRelease'])
            case['lateActivationAfterRelease']=classify_input(case['finalAfterRelease'])
        except Deadline:raise
        except Exception as e:case['error']=str(e)[:1200]
        finally:
            if session:
                try:case['afterCapture']=image('neutral-'+route+'-after');case['afterNativeCapture']=image('neutral-'+route+'-after-native',True)
                finally:close_session()
            if not all(case.get(k) for k in ['beforeCapture','beforeNativeCapture','afterCapture','afterNativeCapture']):case.update(status='HOLD',captureGate='Mandatory control before/after screenshot missing')
            r['input'].append(case);persist()
        return case['status']=='PASS'
    def alarm(*_):raise Deadline('Independent 480-second probe deadline')
    signal.signal(signal.SIGALRM,alarm);signal.alarm(480)
    try:
        if platform.system()!='Darwin' or os.environ.get('GITHUB_REPOSITORY')!='cgam-coder/vigia-aesan-feed':raise RuntimeError('Authorized public standard macOS runner only')
        mark('verified-runtime')
        sdk=cmd(['xcrun','--sdk','iphonesimulator','--show-sdk-version'],20).strip()
        device,runtime=SMOKE.choose_device(json.loads(cmd(['xcrun','simctl','list','--json'],75)),sdk)
        r['environment']={'model':device['name'],'iOS':runtime['version'],'build':runtime.get('buildversion'),'xcode':cmd(['xcodebuild','-version']),'macOS':cmd(['sw_vers'])}
        sim=cmd(['xcrun','simctl','create','UI-isolate-'+os.environ.get('GITHUB_RUN_ID','local'),device['deviceTypeIdentifier'],runtime['identifier']],60).strip()
        if not re.fullmatch('[a-fA-F0-9-]{36}',sim):raise RuntimeError('Invalid disposable simulator ID')
        r['simulatorUDID']=sim
        mark('boot-own-simulator');cmd(['xcrun','simctl','boot',sim],20);cmd(['xcrun','simctl','bootstatus',sim,'-b'],120)
        developer=cmd(['xcode-select','-p']).strip();cmd(['open','-a',developer+'/Applications/Simulator.app','--args','-CurrentDeviceUDID',sim],15)
        cmd(['xcrun','simctl','ui',sim,'appearance','dark'],15)
        r['safariLaunch']=attempt(lambda:cmd(['xcrun','simctl','launch',sim,'com.apple.mobilesafari'],25))
        r['initialDarkNavigation']=attempt(lambda:cmd(['xcrun','simctl','openurl',sim,TARGET],25));time.sleep(5)
        image('initial-dark-before-driver-native',True)
        mark('driver-start');cmd(['sudo','-n','/usr/bin/safaridriver','--enable'],20)
        driver=subprocess.Popen(['/usr/bin/safaridriver','-p','4444'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,stdin=subprocess.DEVNULL,start_new_session=True);time.sleep(2)
        mark('theme-independent-of-input')
        try:
            new_session()
            observe_theme_case('theme-dark-first-access','dark',True)
            observe_theme_case('theme-live-light','light')
            observe_theme_case('theme-light-reload','light',True)
            observe_theme_case('theme-live-dark','dark')
        except Deadline:raise
        except Exception as e:r['themeInfrastructureHold']=str(e)[:1400]
        finally:close_session()
        class FixtureHandler(BaseHTTPRequestHandler):
            def log_message(self,*_):pass
            def do_GET(self):
                if not self.path.startswith('/control'):self.send_error(404);return
                raw=FIXTURE.encode();self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
            def do_POST(self):
                if self.path!='/observe':self.send_error(404);return
                length=int(self.headers.get('Content-Length','0'))
                if length>20000:self.send_error(413);return
                value=json.loads(self.rfile.read(length));r['fixtureTelemetry'].append({'time':time.time(),'data':value});self.send_response(204);self.end_headers()
        server=ThreadingHTTPServer(('127.0.0.1',8765),FixtureHandler);threading.Thread(target=server.serve_forever,daemon=True).start()
        good=calibrate('touch')
        if not good:good=calibrate('element')
        r['nativeInputVerified']=good
        r['next']='Use calibrated route on exact Preview' if good else 'SafariDriver neutral input HOLD; existing XCTest needs bounded reused-simulator microtest'
        if not good:
            # Pre-reviewed minimal XCTest uses already-booted simulator; never coexists with SafariDriver.
            mark('stop-driver-before-xctest')
            os.killpg(driver.pid,signal.SIGKILL);driver.wait(timeout=5);driver=None;r['cleanup']['driverBeforeXCTest']=True
            r['xctest']=attempt(lambda:run_xctest(sim,cmd,OUT)) if time.monotonic()-started<305 else {'ok':False,'budgetHold':'Not enough supervisor budget for a bounded XCTest compile/tap; NOT_EXECUTED'}
            if r['xctest']['ok']:r['nativeInputVerified']=r['xctest']['value'].get('controlVerified',False)
        persist()
    except Exception as e:
        r['infrastructureHold']={'stage':stage,'error':type(e).__name__+': '+str(e)[:1600]}
        if sim:
            try:image('failure-native',True)
            except Exception:pass
    finally:
        signal.alarm(0)
        try:close_session()
        except Exception as e:r['cleanup']['sessionError']=str(e)[:500]
        if driver:
            try:os.killpg(driver.pid,signal.SIGKILL);driver.wait(timeout=5);r['cleanup']['driverProcess']=True
            except Exception as e:r['cleanup']['driverProcess']=False
        if server:server.shutdown();server.server_close();r['cleanup']['localServer']=True
        if sim and re.fullmatch('[a-fA-F0-9-]{36}',sim):
            for action in ['shutdown','delete']:r['cleanup'][action]=attempt(lambda a=action:cmd(['xcrun','simctl',a,sim],25))
        persist();print('ISOLATION_RESULT '+json.dumps(r),flush=True)
    return 0 if r['cleanup'].get('shutdown',{}).get('ok') and r['cleanup'].get('delete',{}).get('ok') else 1

def run_xctest(sim,cmd,out):
    cmd(['ruby',str(Path(__file__).with_name('neutral_xctest_project.rb'))],20)
    cmd(['xcrun','simctl','openurl',sim,'http://127.0.0.1:8765/control?route=xctest'],25)
    result={'reusesVerifiedSimulator':True,'safariDriverAbsent':True,'singleTap':True}
    try:cmd(['xcrun','simctl','io',sim,'screenshot',str(out/'xctest-neutral-before-native.png')],20)
    except Deadline:raise
    except Exception as e:result['beforeCaptureHold']=str(e)[:600]
    try:
        log=cmd(['xcodebuild','test','-project','NeutralUI/NeutralUI.xcodeproj','-scheme','NeutralUI','-destination','platform=iOS Simulator,id='+sim,'-derivedDataPath','neutral-derived','-resultBundlePath','NeutralUI.xcresult','-parallel-testing-enabled','NO','-maximum-test-execution-time-allowance','35','CODE_SIGNING_ALLOWED=NO'],155)
        result['controlVerified']="testNeutralTap]' passed" in log
        result['logSummary']=[x[-900:] for x in log.splitlines() if re.search('Test Case|error:|TEST (SUCCEEDED|FAILED)|NEUTRAL_',x)][-20:]
    except Deadline:raise
    except Exception as e:result.update(controlVerified=False,error=str(e)[:1200])
    finally:
        try:cmd(['xcrun','simctl','io',sim,'screenshot',str(out/'xctest-neutral-after-native.png')],20)
        except Exception:pass
        if Path('NeutralUI.xcresult').exists():
            try:
                cmd(['xcrun','xcresulttool','export','attachments','--path','NeutralUI.xcresult','--output-path','neutral-attachments'],20)
                def walk(value):
                    if isinstance(value,dict):
                        yield value
                        for item in value.values():yield from walk(item)
                    elif isinstance(value,list):
                        for item in value:yield from walk(item)
                entries=json.loads(Path('neutral-attachments/manifest.json').read_text())
                for item in walk(entries):
                    name=item.get('suggestedHumanReadableName','');file=item.get('fileName')
                    stem=next((x for x in ['neutral-xctest-before','neutral-xctest-after'] if name.startswith(x)),None)
                    if not stem or not file:continue
                    raw=(Path('neutral-attachments')/Path(file).name).read_bytes();SMOKE.png_info(raw);(out/(stem+'.png')).write_bytes(raw)
            except Deadline:raise
            except Exception as e:result['attachmentHold']=str(e)[:600]
        if not all((out/(n+'.png')).exists() for n in ['neutral-xctest-before','neutral-xctest-after']):result.update(controlVerified=False,captureGate='HOLD: mandatory XCTest before/after attachment missing')
    return result

if __name__=='__main__':
    if sys.argv[1:]==['--self-test']:self_test()
    else:sys.exit(main())
