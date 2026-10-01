import json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from runner import collect,TEST,CASES
class CollectorContract(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.root=Path(self.temp.name);self.export=self.root/'export';self.export.mkdir();self.udid='11111111-2222-3333-4444-555555555555'
  self.items=[]
  for case,stages in CASES['core'].items():
   for stage in stages+['outcome']:
    for kind in ('state','image'):
     if stage=='outcome' and kind=='image':continue
     key=f'public-ui-{case}-{stage}-{kind}';fn=str(len(self.items))+('.json' if kind=='state' else '.png')
     # SYNTHETIC framing fixture, intentionally not a Safari screenshot.
     data=json.dumps({'case':case,'stage':stage,'sequence':len(self.items),'timeMs':len(self.items),'actionsAndAssertions':'COMPLETED'}).encode() if kind=='state' else b'\x89PNG\r\n\x1a\nSYNTHETIC_NOT_A_REAL_IMAGE'
     (self.export/fn).write_bytes(data)
     self.items.append({'suggestedHumanReadableName':key,'exportedFileName':fn,'deviceId':self.udid,'timestamp':len(self.items)})
 def recover(self):
  (self.export/'manifest.json').write_text(json.dumps([{'testIdentifier':TEST['core'],'attachments':self.items}]))
  return collect(self.export,self.root/'out','core',self.udid)
 def test_original_names_and_all_required(self):
  r=self.recover();self.assertFalse(r['errors']);self.assertTrue(all(c['evidence']=='RECOVERED' for c in r['cases'].values()))
  self.assertEqual(r['visualReview'],'PENDING');self.assertTrue(all(c['gate'].startswith('HOLD') for c in r['cases'].values()))
 def test_missing_image_not_pass(self):
  (self.export/self.items[1]['exportedFileName']).unlink();r=self.recover();self.assertTrue(r['errors']);self.assertEqual(r['cases']['consent-reject']['evidence'],'INCOMPLETE')
 def test_wrong_device(self):
  self.items[0]['deviceId']='66666666-2222-3333-4444-555555555555';self.assertTrue(self.recover()['errors'])
 def test_traversal(self):
  self.items[0]['exportedFileName']='../outside.json';self.assertTrue(self.recover()['errors'])
 def test_backslash(self):
  self.items[0]['exportedFileName']='folder\\x.json';self.assertTrue(self.recover()['errors'])
 def test_duplicate(self):
  self.items.append(self.items[0].copy());self.assertTrue(self.recover()['errors'])
 def test_conflicting_filenames(self):
  self.items[0]['fileName']='another.json';self.assertTrue(self.recover()['errors'])
 def test_unknown_own_name(self):
  self.items[0]['suggestedHumanReadableName']='public-ui-unplanned';self.assertTrue(self.recover()['errors'])
 def test_unknown_apple_aux_is_not_product_evidence(self):
  self.items.append({'suggestedHumanReadableName':'Apple auxiliary'});r=self.recover();self.assertFalse(r['errors']);self.assertEqual(len(r['files']),len(self.items)-1)
 def test_wrong_case_association(self):
  (self.export/self.items[0]['exportedFileName']).write_text('{"case":"wrong","stage":"before"}');self.assertTrue(self.recover()['errors'])
 def test_wrong_test_context(self):
  (self.export/'manifest.json').write_text('[{"testIdentifier":"wrong","attachments":[]}]')
  with self.assertRaises(ValueError):collect(self.export,self.root/'out','core',self.udid)
 def test_no_original_overwrite(self):
  r=self.recover();self.assertTrue((self.root/'out/manifest.original.json').exists())
  with self.assertRaises(FileExistsError):self.recover()
 def test_swift_is_native_only(self):
  s=(Path(__file__).parent/'PublicSafariTests.swift').read_text()
  for forbidden in ('URLSession','dataTask','rpc(', 'evaluateJavaScript','localStorage','WebSocket','__BROKER','NSStringFromCGRect'):
   self.assertNotIn(forbidden,s)
 def test_no_indexed_element_firstmatch(self):
  import re
  self.assertIsNone(re.search(r'\["[^\"]+"\]\.firstMatch', (Path(__file__).parent/'PublicSafariTests.swift').read_text()))
if __name__=='__main__':unittest.main()
