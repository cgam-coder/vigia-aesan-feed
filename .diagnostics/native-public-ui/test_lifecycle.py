import json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from lifecycle import CommandRecorder,start_simulator

class LifecycleContract(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name);self.evidence=self.root/'evidence';self.evidence.mkdir();self.report={}
  self.cmd=CommandRecorder(self.root,self.evidence,self.report,lambda:(self.evidence/'report.json').write_text(json.dumps(self.report)))
 def test_success_and_distinct_logs(self):
  for i in range(2):self.assertEqual(self.cmd([sys.executable,'-c',f'print({i})'],3).strip(),str(i))
  entries=self.report['commands'];self.assertNotEqual(entries[0]['log'],entries[1]['log'])
  self.assertEqual((self.evidence/entries[0]['log']).read_text(),'0\n')
 def test_timeout_preserves_command_and_output(self):
  args=[sys.executable,'-u','-c','import time;print("BEFORE_TIMEOUT");time.sleep(9)']
  with self.assertRaisesRegex(RuntimeError,'command timeout'):self.cmd(args,1.5)
  e=self.report['commands'][0];self.assertEqual(e['argv'],args);self.assertEqual(e['status'],'TIMEOUT')
  self.assertIn('BEFORE_TIMEOUT',(self.evidence/e['log']).read_text());self.assertIsNotNone(e['returnCode'])
 def test_failure_preserves_exit_and_output(self):
  with self.assertRaisesRegex(RuntimeError,'code 7'):self.cmd([sys.executable,'-c','print("failure");exit(7)'],3)
  self.assertEqual(self.report['commands'][0]['returnCode'],7)
 def test_existing_original_not_overwritten(self):
  (self.evidence/'build.log').write_text('original')
  with self.assertRaises(FileExistsError):self.cmd([sys.executable,'-c','print("changed")'],3,'build.log')
  self.assertEqual((self.evidence/'build.log').read_text(),'original')
 def test_precise_successful_lifecycle_order_and_bounds(self):
  calls=[];sim='11111111-2222-3333-4444-555555555555';dev='/Applications/Xcode_16.4.app/Contents/Developer'
  start_simulator(lambda a,t:calls.append((a,t)),sim,dev,lambda n:n,lambda n:calls.append(('sleep',n)))
  self.assertEqual([c[1] for c in calls],[20,120,15,5])
  self.assertEqual(calls[0][0],['xcrun','simctl','boot',sim]);self.assertIn('bootstatus',calls[1][0]);self.assertEqual(calls[2][0][0],'open')
 def test_failed_boot_does_not_start_xctest(self):
  calls=[]
  def fail(a,t):calls.append(a);raise RuntimeError('boot stopped')
  with self.assertRaises(RuntimeError):start_simulator(fail,'11111111-2222-3333-4444-555555555555','/Applications/Xcode_16.4.app/Contents/Developer',lambda n:n)
  self.assertEqual(len(calls),1)
 def test_invalid_id_has_no_side_effect(self):
  calls=[]
  with self.assertRaises(ValueError):start_simulator(lambda a,t:calls.append(a),'bad','/Applications/Xcode_16.4.app/Contents/Developer',lambda n:n)
  self.assertFalse(calls)
 def test_runner_cleanup_bounds_and_labels(self):
  s=(Path(__file__).parent/'runner.py').read_text()
  self.assertIn("command(['xcrun','simctl',op,sim],25)",s);self.assertIn("'absenceVerified'",s)
  self.assertNotIn("work/'command.tmp'",s);self.assertIn('left=430-',s)
if __name__=='__main__':unittest.main()
