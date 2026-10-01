"""One bounded standard macOS Appium campaign. Public Preview only, no automatic reruns."""
import hashlib,json,os,re,shutil,signal,subprocess,sys,time,urllib.request,zipfile
from pathlib import Path
from campaign import Client,Matrix,CANDIDATE,ORIGIN

ROOT=Path(__file__).resolve().parent
REPO='cgam-coder/vigia-aesan-feed'
BRANCH='refs/heads/diag/ui-f1a-ios-simulator-20261001'
MAX_ARCHIVE=60_000_000


def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def stop(p):
    if p is None or p.poll() is not None:return
    try:os.killpg(p.pid,signal.SIGTERM)
    except ProcessLookupError:return
    try:p.wait(timeout=3)
    except subprocess.TimeoutExpired:
        try:os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError:return
        p.wait(timeout=3)


def run():
    if sys.platform!='darwin' or os.environ.get('GITHUB_REPOSITORY')!=REPO or os.environ.get('GITHUB_REF')!=BRANCH or os.environ.get('GITHUB_RUN_ATTEMPT')!='1':raise RuntimeError('Not the authorized single standard Apple run')
    if os.environ.get('DEVELOPER_DIR')!='/Applications/Xcode_16.4.app/Contents/Developer':raise RuntimeError('Unreviewed Xcode')
    base=Path(os.environ['RUNNER_TEMP'])/'nagamealert-appium';base.mkdir(exist_ok=False)
    evidence=base/'evidence';evidence.mkdir();deps=base/'deps';deps.mkdir()
    started=time.monotonic();test_end=started+1260;cleanup_end=started+1440
    report={'campaign':'APPIUM-NATIVE-20261001','candidate':CANDIDATE,'origin':ORIGIN,'runId':os.environ['GITHUB_RUN_ID'],'diagnosticCommit':os.environ['GITHUB_SHA'],'nativeJobs':1,'maxJobMinutes':30,'testBudgetSeconds':1260,'recoveryDeadlineSeconds':1440,'commands':[],'sessions':[],'cleanup':[],'productGate':'HOLD','startedMs':round(time.time()*1000)}
    server=None;serverlog=None;owned=[];client=None;serial=0;original_keyboard=None
    def save():(evidence/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    def command(args,seconds=20,cwd=None,final=False):
        nonlocal serial
        end=cleanup_end if final else test_end
        remaining=end-time.monotonic()-7
        if remaining<=0:raise RuntimeError('Protected recovery deadline')
        timeout=min(seconds,remaining);serial+=1;name=f'command-{serial:03d}.log'
        entry={'argv':args,'log':name,'startedMs':round(time.time()*1000),'timeoutSeconds':timeout,'status':'STARTED'};report['commands'].append(entry);save()
        p=None
        try:
            with (evidence/name).open('xb') as f:
                p=subprocess.Popen(args,cwd=cwd,stdout=f,stderr=subprocess.STDOUT,stdin=subprocess.DEVNULL,start_new_session=True)
                code=p.wait(timeout=timeout)
            entry['code']=code;entry['status']='COMPLETED' if code==0 else 'FAILED'
            if code:raise RuntimeError('Command failed: '+' '.join(args[:4])+'; see '+name)
            return (evidence/name).read_text(errors='replace')
        except subprocess.TimeoutExpired:
            entry['status']='TIMEOUT';stop(p);raise RuntimeError('Timeout: '+' '.join(args[:4]))
        finally:entry['endedMs']=round(time.time()*1000);save()
    def delete_owned(udid):
        item={'udid':udid,'shutdown':'NOT_ATTEMPTED','delete':'NOT_ATTEMPTED','absenceVerified':False}
        report['cleanup'].append(item)
        for op,seconds in [('shutdown',20),('delete',20)]:
            try:command(['xcrun','simctl',op,udid],seconds,final=True);item[op]='COMPLETED'
            except Exception as e:item[op]=str(e)
        try:
            inventory=json.loads(command(['xcrun','simctl','list','devices','--json'],10,final=True))
            groups=inventory.get('devices')
            if not isinstance(groups,dict) or not all(isinstance(v,list) for v in groups.values()):raise ValueError('Invalid resource inventory')
            item['absenceVerified']=not any(d.get('udid')==udid for group in groups.values() for d in group)
        except Exception as e:item['verificationError']=str(e)
        save();return item['delete']=='COMPLETED' and item['absenceVerified']
    try:
        save();sdk=command(['xcrun','--sdk','iphonesimulator','--show-sdk-version']).strip()
        if sdk!='18.5':raise RuntimeError('SDK mismatch; no runtime download authorized')
        report['host']={'sdk':sdk,'xcode':command(['xcodebuild','-version']).strip(),'os':command(['sw_vers']).strip()};save()
        lockdir=Path(os.environ['RUNNER_TEMP'])/'appium-lock'
        lock=lockdir/'package-lock.json';manifest=json.loads((lockdir/'lock-integrity.json').read_text())
        if sha(lock)!=manifest['sha256']:raise RuntimeError('Preflight dependency lock altered')
        shutil.copy2(lock,deps/'package-lock.json');shutil.copy2(ROOT/'package.json',deps/'package.json')
        report['dependencyLock']=manifest;save()
        command(['npm','ci','--ignore-scripts','--no-audit','--no-fund'],240,cwd=deps)
        command(['npm','ls','--depth=0','--json'],15,cwd=deps)
        serverlog=(evidence/'appium-server.log').open('xb')
        child_env=os.environ.copy();child_env.pop('APPIUM_HOME',None)
        # npm-project extension discovery; private credentials are never passed by this workflow.
        server=subprocess.Popen([str(deps/'node_modules/.bin/appium'),'--address','127.0.0.1','--port','4723','--log-level','info','--log-no-colors'],cwd=deps,env=child_env,stdout=serverlog,stderr=subprocess.STDOUT,stdin=subprocess.DEVNULL,start_new_session=True)
        report['serverPid']=server.pid;save()
        ready=False
        for _ in range(30):
            if server.poll() is not None:raise RuntimeError('Appium exited before readiness')
            try:
                with urllib.request.urlopen('http://127.0.0.1:4723/status',timeout=2) as r:ready=json.load(r).get('value',{}).get('ready',False)
                if ready:break
            except (OSError,ValueError):pass
            time.sleep(1)
        if not ready:raise RuntimeError('Appium not ready; no restart permitted')
        try:original_keyboard=command(['defaults','read','com.apple.iphonesimulator','ConnectHardwareKeyboard'],5).strip()
        except Exception:
            # New dedicated runner profile only; record unknown without pretending absence.
            last=(evidence/report['commands'][-1]['log']).read_text(errors='replace')
            original_keyboard='ABSENT' if 'does not exist' in last else 'UNKNOWN'
            report['keyboardOriginal']=original_keyboard
        for choice in ('rejected','accepted'):
            if test_end-time.monotonic()<240:
                report['sessions'].append({'choice':choice,'status':'NOT_EXECUTED_BUDGET'});break
            udid=command(['xcrun','simctl','create','NA-Appium-'+choice+'-'+os.environ['GITHUB_RUN_ID'],'com.apple.CoreSimulator.SimDeviceType.iPhone-16','com.apple.CoreSimulator.SimRuntime.iOS-18-5'],75).strip()
            if not re.fullmatch('[A-Fa-f0-9-]{36}',udid):raise RuntimeError('Invalid owned simulator identity')
            owned.append(udid);save()
            item={'choice':choice,'udid':udid,'status':'PREPARING','cases':[]};report['sessions'].append(item);save()
            try:
                command(['xcrun','simctl','boot',udid],20);command(['xcrun','simctl','bootstatus',udid,'-b'],120)
                command(['open','-a',os.environ['DEVELOPER_DIR']+'/Applications/Simulator.app','--args','-CurrentDeviceUDID',udid],15);time.sleep(5)
                client=Client(evidence/choice,test_end);client.create(udid,base/'wda-derived')
                item['status']='SESSION_CREATED';save();Matrix(client,item).execute(choice)
                item['status']='CLIENT_FINISHED';save()
            except Exception as e:item['status']='HOLD_INFRASTRUCTURE';item['reason']=type(e).__name__+': '+str(e)[:1500];save()
            finally:
                if client:
                    client.deadline=min(cleanup_end,time.monotonic()+30)
                    try:client.close();item['sessionClosed']=True
                    except Exception as e:item['sessionClosed']=False;item['sessionCloseError']=str(e)[:700]
                    client=None
                clean=delete_owned(udid)
                if clean:owned.remove(udid)
                item['resourceCleanup']=clean;save()
            # Session transport/native observation must have actually worked before a second clean profile.
            capability=next((c for c in item['cases'] if c['id']=='capability-and-clean-preview'),{})
            if not clean or not item.get('sessionClosed') or capability.get('status')!='ASSERTIONS_PASS':
                report['secondSessionGate']='HOLD';break
    except Exception as e:report['stop']=type(e).__name__+': '+str(e)[:2000]
    finally:
        for udid in list(owned):
            # No blind retry of an already attempted resource deletion.
            if any(x['udid']==udid for x in report['cleanup']):continue
            try:delete_owned(udid)
            except Exception as e:report['cleanup'].append({'udid':udid,'absenceVerified':False,'error':str(e)})
        stop(server)
        if serverlog:serverlog.close()
        report['appiumStopped']=server is None or server.poll() is not None
        if original_keyboard in ('0','1'):
            try:
                command(['defaults','write','com.apple.iphonesimulator','ConnectHardwareKeyboard','-bool','YES' if original_keyboard=='1' else 'NO'],5,final=True)
                report['keyboardRestored']=command(['defaults','read','com.apple.iphonesimulator','ConnectHardwareKeyboard'],5,final=True).strip()==original_keyboard
            except Exception:report['keyboardRestored']=False
        elif original_keyboard=='ABSENT':
            try:command(['defaults','delete','com.apple.iphonesimulator','ConnectHardwareKeyboard'],5,final=True);report['keyboardRestored']=True
            except Exception:report['keyboardRestored']=False
        elif original_keyboard=='UNKNOWN':report['keyboardRestored']='UNVERIFIED_DISPOSABLE_RUNNER'
        report['elapsedSeconds']=round(time.monotonic()-started,3)
        report['resourceCleanup']='PASS' if report['appiumStopped'] and all(x.get('absenceVerified') for x in report['cleanup']) and (bool(report['cleanup']) or not owned) else 'HOLD'
        report['productGate']='HOLD_REQUIRES_CASE_AND_VISUAL_REVIEW';save()
        files=[];total=0
        for p in sorted(evidence.rglob('*')):
            if p.is_symlink():raise RuntimeError('Unexpected symlink in evidence')
            if not p.is_file():continue
            if p.suffix not in ('.json','.png','.log'):raise RuntimeError('Unreviewed evidence extension')
            total+=p.stat().st_size
            if total>MAX_ARCHIVE:raise RuntimeError('Evidence exceeds reviewed size ceiling')
            files.append({'path':p.relative_to(evidence).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)})
        (evidence/'manifest.json').write_text(json.dumps({'candidate':CANDIDATE,'files':files},indent=2))
        with zipfile.ZipFile(base/'evidence.zip','x',zipfile.ZIP_DEFLATED) as z:
            for p in sorted(evidence.rglob('*')):
                if p.is_file():z.write(p,p.relative_to(evidence).as_posix())
        (base/'integrity.json').write_text(json.dumps({'sha256':sha(base/'evidence.zip'),'bytes':(base/'evidence.zip').stat().st_size}))
        print(json.dumps({'campaign':report['campaign'],'elapsedSeconds':report['elapsedSeconds'],'resourceCleanup':report['resourceCleanup'],'productGate':report['productGate'],'stop':report.get('stop')}))
    return 0 if report.get('resourceCleanup')=='PASS' and len(report['sessions'])==2 and all(s.get('status')=='CLIENT_FINISHED' and s.get('cases') and all(c.get('status')=='ASSERTIONS_PASS' for c in s['cases']) for s in report['sessions']) else 2

if __name__=='__main__':sys.exit(run())
