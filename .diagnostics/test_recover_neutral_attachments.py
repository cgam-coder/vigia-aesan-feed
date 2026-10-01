"""Synthetic local fixtures only. These tests do not run Apple XCTest or Safari."""
import json
from pathlib import Path
import struct
import tempfile
import unittest
import zlib
from recover_neutral_attachments import recover, entries


def png(value):
    def chunk(kind, raw):
        return struct.pack('>I', len(raw)) + kind + raw + struct.pack('>I', zlib.crc32(kind + raw))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 256, 256, 8, 0, 0, 0, 0)) + chunk(b'IDAT', zlib.compress((b'\0' + bytes([value])*256)*256)) + chunk(b'IEND', b'')


class CollectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.export = self.root / 'export'; self.export.mkdir()
        self.items = []
        self.add('neutral-xctest-before', 'a.png', png(0))
        self.add('neutral-xctest-after', 'b.png', png(1))

    def add(self, logical, filename, raw):
        (self.export / filename).write_bytes(raw)
        self.items.append({'exportedFileName': filename, 'suggestedHumanReadableName': logical + '_0_UUID.' + filename.rsplit('.', 1)[-1]})

    def run_collector(self):
        (self.export / 'manifest.json').write_text(json.dumps([{'testIdentifier':'NeutralUITests/testNeutralTap()', 'attachments':self.items}]))
        return recover(self.export, self.root / 'recovered')

    def test_old_reader_silently_loses_valid_exported_filename(self):
        manifest = [{'attachments':self.items}]
        old_selected = [x for x in entries(manifest) if x.get('fileName')]
        self.assertEqual(old_selected, [])
        self.assertTrue(self.run_collector()['imagePairRecovered'])

    def test_names_and_original_bytes_preserved(self):
        report = self.run_collector()
        self.assertTrue(report['imagePairRecovered'])
        self.assertEqual((self.root/'recovered'/'neutral-xctest-before.png').read_bytes(), png(0))
        self.assertEqual((self.root/'recovered'/'manifest.original.json').read_bytes(), (self.export/'manifest.json').read_bytes())
        self.assertIsNone(report['productPass'])

    def test_state_recovery(self):
        self.add('neutral-state-before-tap', 's.json', json.dumps({'stage':'before-tap','counterBefore':0,'xctestStarted':True}).encode())
        report = self.run_collector()
        self.assertEqual(report['states'][0]['payload']['counterBefore'], 0)

    def test_missing_schema_fails_visibly(self):
        del self.items[0]['exportedFileName']
        report = self.run_collector()
        self.assertFalse(report['imagePairRecovered']); self.assertTrue(report['errors'])

    def test_missing_before_does_not_pass(self):
        self.items.pop(0)
        self.assertFalse(self.run_collector()['imagePairRecovered'])

    def test_conflicting_filename_fields(self):
        self.items[0]['fileName'] = 'other.png'
        self.assertFalse(self.run_collector()['imagePairRecovered'])

    def test_duplicate_logical_name_rejected(self):
        self.add('neutral-xctest-before', 'c.png', png(2))
        self.assertFalse(self.run_collector()['imagePairRecovered'])

    def test_traversal_rejected(self):
        self.items[0]['exportedFileName'] = '../escape.png'
        self.assertFalse(self.run_collector()['imagePairRecovered'])

    def test_symlink_rejected(self):
        (self.export/'a.png').unlink(); (self.root/'outside.png').write_bytes(png(0))
        (self.export/'a.png').symlink_to(self.root/'outside.png')
        self.assertFalse(self.run_collector()['imagePairRecovered'])

    def test_same_post_image_cannot_replace_before(self):
        (self.export/'a.png').write_bytes(png(1))
        self.assertFalse(self.run_collector()['imagePairRecovered'])

    def test_json_is_not_png(self):
        (self.export/'a.png').write_bytes(b'{"not":"image"}')
        self.assertFalse(self.run_collector()['imagePairRecovered'])

    def test_jpeg_bytes_not_mislabelled_png(self):
        # Signature fixture, NOT a real screenshot; decoder/visual validation is separate.
        (self.export/'a.png').write_bytes(b'\xff\xd8\xff' + b'X'*100 + b'\xff\xd9')
        report = self.run_collector()
        first = next(x for x in report['copied'] if x['logicalName']=='neutral-xctest-before')
        self.assertEqual(first['output'], 'neutral-xctest-before.jpg')

    def test_no_overwrite(self):
        self.run_collector()
        with self.assertRaises(FileExistsError): recover(self.export, self.root/'recovered')

    def test_unknown_attachment_not_copied(self):
        self.add('unapproved-output', 'other.json', b'{}')
        report = self.run_collector()
        self.assertEqual(report['ignoredCount'], 1)
        self.assertEqual(len(report['copied']), 2)

    def test_state_identity_mismatch(self):
        self.add('neutral-state-before-tap', 's.json', b'{"stage":"after-tap"}')
        self.assertFalse(self.run_collector()['imagePairRecovered'])



class ReviewTests(unittest.TestCase):
    setUp=CollectorTests.setUp
    add=CollectorTests.add
    run_collector=CollectorTests.run_collector
    def test_wrong_testcase_rejected(self):
        (self.export/'manifest.json').write_text(json.dumps([{'testIdentifier':'Wrong/test()', 'attachments':self.items}]))
        self.assertFalse(recover(self.export,self.root/'recovered')['imagePairRecovered'])
    def test_unknown_neutral_name_is_visible(self):
        self.add('neutral-unrecognized-stage','u.json',b'{}')
        self.assertTrue(self.run_collector()['errors'])
    def test_duplicate_source_rejected(self):
        self.items[1]['exportedFileName']='a.png'
        self.assertTrue(self.run_collector()['errors'])
    def test_manifest_symlink_rejected(self):
        target=self.root/'outside-manifest';target.write_text('[]')
        (self.export/'manifest.json').symlink_to(target)
        with self.assertRaises(ValueError):recover(self.export,self.root/'recovered')
    def test_classification_independent_of_recovery(self):
        from recover_neutral_attachments import classify_execution
        tests={'testNodes':[{'nodeType':'Test Case','nodeIdentifier':'NeutralUITests/testNeutralTap()','result':'Passed'}]}
        summary={'totalTestCount':1,'passedTests':1,'failedTests':0}
        result=classify_execution(tests,summary,'')
        self.assertEqual(result['status'],'EXECUTED_PASSED');self.assertTrue(result['xctestStarted'])
        unknown=classify_execution({}, {}, '')
        self.assertEqual(unknown['status'],'UNKNOWN');self.assertIsNone(unknown['xctestStarted'])
        self.assertEqual(classify_execution({}, {}, "testNeutralTap]' started.")['status'],'EXECUTED_RESULT_UNKNOWN')
    def test_states_require_context_order_and_transition(self):
        from recover_neutral_attachments import state_gate,TEST_ID
        before={'xctestStarted':True,'safariForeground':True,'fixtureLoaded':True,'targetHittable':True,'counterBefore':0,'tapAttempted':False,'dateMs':100,'testIdentifier':TEST_ID}
        after={'tapAttempted':True,'tapReturned':True,'counterAfter':1,'dateMs':200,'testIdentifier':TEST_ID}
        r={'states':[{'logicalName':'neutral-state-before-tap','payload':before},{'logicalName':'neutral-state-after-tap','payload':after}]}
        self.assertTrue(state_gate(r));after['dateMs']=99;self.assertFalse(state_gate(r))

if __name__=='__main__': unittest.main(verbosity=2)
