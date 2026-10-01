"""Offline tests; no Safari/native product certification is claimed."""
import ast,base64,hashlib,json,struct,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
import campaign

class Contracts(unittest.TestCase):
    def test_navigation_allowlist(self):
        self.assertTrue(campaign.allowed_url(campaign.ORIGIN+'/es/alertas?source=AESAN&q=x'))
        for u in ['https://nagamealert.com/es/alertas',campaign.ORIGIN+'/api/freshness?recover=1',campaign.ORIGIN+'/admin',campaign.ORIGIN+'/es/alertas#x','http://x/es/alertas']:
            self.assertFalse(campaign.allowed_url(u))
    def test_observer_read_only(self):
        for token in ['.click(','.focus(','.setItem(','.removeItem(','.fetch(','.dispatchEvent(','document.cookie','XMLHttpRequest','WebSocket','eval(','new Function']:
            self.assertNotIn(token,campaign.OBSERVE)
        self.assertEqual(campaign.OBSERVE.count('localStorage.getItem('),2)
        self.assertIn("location.origin !== '"+campaign.ORIGIN+"'",campaign.OBSERVE)
    def test_no_appearance_simctl_dependency(self):
        source=Path(__file__).with_name('runner.py').read_text()
        self.assertNotIn("'appearance'",source)
        self.assertNotIn('relaxed-security',source)
        self.assertNotIn('allow-insecure',source)
        self.assertIn("'127.0.0.1'",source)
    def test_png_checked(self):
        b=b'\x89PNG\r\n\x1a\n'+b'12345678'+struct.pack('>II',1179,2556)
        self.assertEqual(campaign.png_dimensions(b),(1179,2556))
        for raw in [b'',b'wrong',b'\x89PNG\r\n\x1a\n'+b'12345678'+struct.pack('>II',99999,99999)]:
            with self.assertRaises(campaign.SetupError):campaign.png_dimensions(raw)
    def test_process_result_not_product_gate(self):
        s=Path(__file__).with_name('runner.py').read_text()
        self.assertIn("HOLD_REQUIRES_CASE_AND_VISUAL_REVIEW",s)
        self.assertIn("all(c.get('status')=='ASSERTIONS_PASS'",s)
    def test_assertion_failed_not_pass(self):
        with tempfile.TemporaryDirectory() as d:
            c=campaign.Client(d,time.monotonic()+100);c.poisoned=True;r={};m=campaign.Matrix(c,r)
            m.case('fixture',lambda:None)
            self.assertEqual(r['cases'][0]['status'],'NOT_EXECUTED')
    def test_case_result_failure_distinct(self):
        with tempfile.TemporaryDirectory() as d:
            c=campaign.Client(d,time.monotonic()+100);r={};m=campaign.Matrix(c,r)
            with patch.object(c,'capture'):
                m.case('bad',lambda:campaign.expect(False,'observed mismatch'))
            self.assertEqual(r['cases'][0]['status'],'OBSERVED_FAILURE')
    def test_preparation_failure_distinct(self):
        with tempfile.TemporaryDirectory() as d:
            c=campaign.Client(d,time.monotonic()+100);r={};m=campaign.Matrix(c,r)
            def bad():raise campaign.SetupError('not available')
            with patch.object(c,'capture'):m.case('bad',bad)
            self.assertEqual(r['cases'][0]['status'],'HOLD_PREPARATION')
    def test_case_success_still_needs_visual(self):
        with tempfile.TemporaryDirectory() as d:
            c=campaign.Client(d,time.monotonic()+100);r={};m=campaign.Matrix(c,r);m.case('ok',lambda:None)
            self.assertEqual(r['cases'][0]['status'],'ASSERTIONS_PASS');self.assertEqual(r['cases'][0]['visualReview'],'PENDING')
    def test_budget_never_runs_case(self):
        with tempfile.TemporaryDirectory() as d:
            c=campaign.Client(d,time.monotonic()+10);r={};m=campaign.Matrix(c,r)
            def fail():raise AssertionError('must not run')
            m.case('no-time',fail);self.assertEqual(r['cases'][0]['status'],'NOT_EXECUTED')
    def test_no_implicit_second_session_on_setup_failure(self):
        s=Path(__file__).with_name('runner.py').read_text()
        self.assertIn("capability.get('status')!='ASSERTIONS_PASS'",s)
    def test_scope_mobile_applications(self):
        with tempfile.TemporaryDirectory() as d:
            c=campaign.Client(d,time.monotonic()+100)
            with self.assertRaises(campaign.SetupError):c.mobile('shell',{'command':'anything'})
            with self.assertRaises(campaign.SetupError):c.mobile('activateApp',{'bundleId':'other.application'})
    def test_empty_path_cleanup_allowed(self):
        with tempfile.TemporaryDirectory() as d:
            c=campaign.Client(d,time.monotonic()+100);c.sid='fixture'
            class Response:
                def __enter__(self):return self
                def __exit__(self,*a):pass
                def read(self,*a):return b'{"value":null}'
            with patch('urllib.request.urlopen',return_value=Response()) as request:
                c.close();self.assertIsNone(c.sid);self.assertTrue(request.called)
    def test_unsafe_evidence_path(self):
        with tempfile.TemporaryDirectory() as d:
            c=campaign.Client(d,time.monotonic()+100)
            with self.assertRaises(campaign.SetupError):c.capture('../bad',{})
    def test_cold_dark_precedes_product_navigation(self):
        s=Path(__file__).with_name('campaign.py').read_text();part=s[s.index('    def execute(self,choice):'):]
        self.assertLess(part.index('cold-dark-first-product-load'),part.index('capability-and-clean-preview'))
    def test_matrix_budget_includes_full_scope(self):
        s=Path(__file__).with_name('campaign.py').read_text()
        for method in ['consent','manual','precedence','filters','keyboard','orientation','scroll','pinch','map_detail','cold_dark']:
            self.assertIn('def '+method+'(',s)
    def test_original_product_not_checked_out(self):
        s=Path(__file__).with_name('runner.py').read_text()
        self.assertNotIn('VIGIA_SYNC_TOKEN',s);self.assertNotIn('CLOUDFLARE_API_TOKEN',s)
    def test_syntax(self):
        for name in ['campaign.py','runner.py']:ast.parse(Path(__file__).with_name(name).read_text())

if __name__=='__main__':unittest.main()
