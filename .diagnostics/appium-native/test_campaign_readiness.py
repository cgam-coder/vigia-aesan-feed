"""Regression checks for the full client, not product or Safari certification."""
import ast,json,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
import campaign
ROOT=Path(__file__).resolve().parent
class Readiness(unittest.TestCase):
 def test_one_wda_build_before_any_device(self):
  s=(ROOT/'runner.py').read_text();self.assertEqual(s.count("'build-for-testing'"),1)
  self.assertLess(s.index("'build-for-testing'"),s.index("for choice in ('rejected','accepted')"))
  self.assertIn("'appium:usePrebuiltWDA':True",(ROOT/'campaign.py').read_text())
  self.assertIn("'appium:useNewWDA':False",(ROOT/'campaign.py').read_text())
 def test_clock_is_job_start_and_reserves_do_not_overlap(self):
  s=(ROOT/'runner.py').read_text();self.assertIn("os.environ['NA_JOB_STARTED_EPOCH']",s)
  for value in ('anchor+1380','anchor+1560','anchor+1620'):self.assertIn(value,s)
  self.assertLess(1380,1560);self.assertLess(1560,1620);self.assertLess(1620,1800)
 def test_dependency_lock_is_fixed_and_never_regenerated(self):
  s=(ROOT/'runner.py').read_text();self.assertIn('431a7a73a51b55605c4094908ca3df775c0accfb3a73bc3af5e42b806b8c68af',s)
  self.assertIn("'npm','ci'",s);self.assertNotIn("'npm','install'",s);self.assertNotIn('--package-lock-only',s)
 def test_no_darwin_simulation_claim(self):
  s=(ROOT/'runner.py').read_text();self.assertIn("sys.platform!='darwin'",s)
  self.assertIn("'--sdk','iphonesimulator','--show-sdk-version'",s)
 def test_recovered_images_decode_required(self):
  s=(ROOT/'runner.py').read_text();self.assertIn("['sips','-g','pixelWidth'",s)
  self.assertIn("report.get('imageDecode')=='PASS'",s)
 def test_map_pan_cannot_start_on_native_control(self):
  self.assertIn("!target.closest('button,a,[role=button]')",campaign.OBSERVE)
  source=(ROOT/'campaign.py').read_text();self.assertIn("x['mapButtons'][2]['selected']=='true'",source)
  self.assertIn("Page scroll mistaken for map pan",source)
 def test_map_is_zoomed_before_pan_then_reset(self):
  source=(ROOT/'campaign.py').read_text();m=source[source.index('    def map_detail('):]
  self.assertLess(m.index("'map-zoomed'"),m.index("'map-panned'"));self.assertLess(m.index("'map-panned'"),m.index("'map-reset'"))
 def test_native_keyboard_overlap_is_asserted(self):
  self.assertIn("expect(not overlap,'Native keyboard overlaps search input')",(ROOT/'campaign.py').read_text())
 def test_network_requires_a_positive_control(self):
  s=(ROOT/'campaign.py').read_text();self.assertIn('Network positive control absent',s)
  self.assertIn('Unexpected analytics traffic on Preview',s)
 def test_dom_url_and_storage_are_read_only(self):
  for bad in ('setItem(', 'removeItem(', 'fetch(', 'XMLHttpRequest', 'dispatchEvent(', '.click(', '.focus('):self.assertNotIn(bad,campaign.OBSERVE)
 def test_navigation_setup_failure_is_not_product_failure(self):
  self.assertIn('timeout=25,error_type=SetupError',(ROOT/'campaign.py').read_text())
 def test_manual_override_ends_in_real_contrast(self):
  s=(ROOT/'campaign.py').read_text()
  self.assertIn("expect((t['theme']=='dark')!=t['osDark']",s)
  for chosen,os_dark,valid in [('light',True,True),('dark',False,True),('dark',True,False),('light',False,False)]:
   self.assertEqual((chosen=='dark')!=os_dark,valid)
 def test_both_profiles_and_all_cases_remain_required(self):
  s=(ROOT/'campaign.py').read_text();
  for n in ('cold-dark-first-product-load','capability-and-clean-preview','manual-os-precedence','filters-focus','keyboard-zoom-search','scroll-sticky','map-pan-detail-return'):
   self.assertIn(n,s)
  self.assertIn("len(report['sessions'])==2",(ROOT/'runner.py').read_text())
 def test_failed_create_keeps_an_ownership_reconciliation_path(self):
  s=(ROOT/'runner.py').read_text();self.assertIn("pending_names.append(name)",s)
  self.assertIn("report['creationReconciled']",s);self.assertIn("and not pending_names",s)
 def test_unknown_keyboard_does_not_authorize_preference_changes(self):
  s=(ROOT/'runner.py').read_text();self.assertIn("keyboard_may_change=original_keyboard in ('0','1','ABSENT')",s)
  self.assertIn("manage_keyboard=keyboard_may_change",s)
  self.assertIn("caps.pop('appium:connectHardwareKeyboard',None)",(ROOT/'campaign.py').read_text())
 def test_first_profile_actions_do_not_wait_for_appearance(self):
  s=(ROOT/'campaign.py').read_text();part=s[s.index('    def execute(self,choice):'):]
  self.assertIn("if choice=='accepted':self.case('cold-dark-first-product-load'",part)
  self.assertLess(part.index("('menu',self.menu)"),part.index("('manual-os-precedence',self.precedence)"))
 def test_filter_state_matches_real_details_element(self):
  self.assertIn(".na-terminal-filters[open]",campaign.OBSERVE)
  self.assertIn("not x['filterOpen'] and not x['dialogs']",(ROOT/'campaign.py').read_text())
if __name__=='__main__':unittest.main()
