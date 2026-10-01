"""Owned child processes and simulator lifecycle; no browser instrumentation."""
import os, re, signal, subprocess, time
from pathlib import Path

class CommandRecorder:
    def __init__(self,work,evidence,report,save):
        self.work=Path(work);self.evidence=Path(evidence);self.report=report;self.save=save
        self.serial=0
    def __call__(self,args,timeout,log=None):
        if not args or timeout<=0:raise ValueError('invalid command deadline')
        self.serial+=1
        label='-'.join(args[:3])
        label=re.sub('[^a-z0-9-]+','-',label.lower()).strip('-')[:80]
        filename=log or f'lifecycle-{self.serial:03d}-{label}.log'
        if Path(filename).name!=filename:raise ValueError('invalid log name')
        dest=self.evidence/filename
        entry={'sequence':self.serial,'argv':list(args),'log':filename,'timeoutSeconds':timeout,
               'startedAtMs':round(time.time()*1000),'status':'STARTED'}
        self.report.setdefault('commands',[]).append(entry)
        self.report['lastCommand']=list(args);self.save()
        begun=time.monotonic();p=None
        try:
            with dest.open('xb') as f:
                p=subprocess.Popen(args,stdout=f,stderr=subprocess.STDOUT,stdin=subprocess.DEVNULL,start_new_session=True)
                try:
                    code=p.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    entry['status']='TIMEOUT'
                    self._stop(p)
                    raise RuntimeError('command timeout: '+' '.join(args))
            entry['returnCode']=code
            if code!=0:
                entry['status']='FAILED'
                raise RuntimeError('command failed: '+' '.join(args)+' code '+str(code))
            entry['status']='COMPLETED'
            if dest.stat().st_size>12_000_000:raise RuntimeError('single command log exceeds evidence bound')
            return dest.read_text(errors='replace')
        except BaseException as e:
            if entry['status']=='STARTED':entry['status']='ERROR'
            entry['error']=type(e).__name__+': '+str(e)
            if p is not None and p.poll() is None:self._stop(p)
            raise
        finally:
            entry['finishedAtMs']=round(time.time()*1000)
            entry['elapsedSeconds']=round(time.monotonic()-begun,3)
            if p is not None:entry['returnCode']=p.returncode
            entry['logPresent']=dest.is_file()
            self.save()
    @staticmethod
    def _stop(p):
        if p.poll() is not None:return
        try:os.killpg(p.pid,signal.SIGTERM)
        except ProcessLookupError:return
        try:p.wait(timeout=3)
        except subprocess.TimeoutExpired:
            try:os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError:return
            p.wait(timeout=3)

def start_simulator(command,sim,developer,limit,sleep=time.sleep):
    """Exact previously successful boot -> bootstatus -> Simulator.app -> settle order."""
    if not re.fullmatch('[A-Fa-f0-9-]{36}',sim):raise ValueError('invalid owned simulator')
    if developer!='/Applications/Xcode_16.4.app/Contents/Developer':raise ValueError('unreviewed SDK')
    command(['xcrun','simctl','boot',sim],limit(20))
    command(['xcrun','simctl','bootstatus',sim,'-b'],limit(120))
    command(['open','-a',developer+'/Applications/Simulator.app','--args','-CurrentDeviceUDID',sim],limit(15))
    settle=limit(5)
    if settle<5:raise RuntimeError('insufficient simulator settling time')
    sleep(5)
