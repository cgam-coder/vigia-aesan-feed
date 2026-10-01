"""Offline doubles; never launch Xcode or Safari. A patched harness is not a native PASS."""
import importlib.util,json,os,signal,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('product_runner',Path(__file__).with_name('product_ui_only.py'))
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)

class OrchestrationTests(unittest.TestCase):
 def test_build_failure_cannot_claim_execution_or_cleanup_failure_without_resources(self):
  calls=[]
  class Process:
   pid=123
   def __init__(self,args,**kwargs):self.args=args;self.returncode=65 if args[:2]==['xcodebuild','build-for-testing'] else 0;calls.append(args)
   def communicate(self,timeout):
    if self.args[:3]==['xcrun','--sdk','iphonesimulator']:return b'18.5\n',b''
    return (b'compiler failure double' if self.returncode else b''),b''
  with tempfile.TemporaryDirectory() as d, patch.object(runner,'OUT',Path(d)/'evidence'),patch.object(runner.platform,'system',return_value='Darwin'),patch.dict(os.environ,{'GITHUB_REPOSITORY':'cgam-coder/vigia-aesan-feed','GITHUB_RUN_ATTEMPT':'1'}),patch.object(runner.subprocess,'Popen',Process),patch.object(signal,'alarm'),patch.object(signal,'signal'):
   self.assertEqual(runner.main(),0)
   report=json.loads((Path(d)/'evidence/report.json').read_text())
   self.assertEqual(report['execution']['status'],'NOT_EXECUTED_BUILD_BLOCKED')
   self.assertIs(report['execution']['xctestStarted'],False)
   self.assertEqual(report['cases']['consent']['execution'],'NOT_EXECUTED')
   self.assertEqual(report['cleanup']['gate'],'PASS_NO_RESOURCES_CREATED')
   self.assertNotIn('simulatorUDID',report);self.assertNotIn('testCommandStarted',report)
   self.assertFalse(any('test-without-building' in c or 'create' in c or 'defaults' in c for c in calls))
   self.assertTrue((Path(d)/'evidence/build.log').is_file());self.assertEqual(report['productGate'],'HOLD')
 def test_reviewed_routes_and_budget_are_static_not_calibration(self):
  source=Path(runner.__file__).read_text();swift=Path(runner.__file__).with_name('product_ui_project.rb').read_text()
  self.assertEqual(runner.EXECUTION_SECONDS,410)
  self.assertIn('signal.alarm(75)',source)
  self.assertNotIn('openurl',source);self.assertNotIn('testNeutralTap',source)
  self.assertNotIn('NSStringFromCGRect',swift);self.assertIn('NSCoder.string(for:',swift)
  self.assertIn('safari.activate()',swift);self.assertNotIn('evaluateJavaScript',swift)
  self.assertNotIn('runnable=',swift)

if __name__=='__main__':unittest.main(verbosity=2)
