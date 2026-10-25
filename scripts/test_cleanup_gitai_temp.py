import os
from pathlib import Path
import tempfile
import time
import unittest
from cleanup_gitai_temp import run


@unittest.skipUnless(os.name == 'nt', 'Windows exclusive deletion')
class CleanupTest(unittest.TestCase):
    def test_scope_age_dryrun_and_busy(self):
        with tempfile.TemporaryDirectory(prefix='gitai-cleaner-test-') as tmp:
            root = Path(tmp)
            old = root / 'git-ai-trae-dec-123-0.db'
            busy = root / 'git-ai-trae-dec-124-0.db'
            fresh = root / 'git-ai-trae-dec-125-0.db'
            unrelated = root / 'important.db'
            nested = root / 'nested'
            nested.mkdir()
            child = nested / old.name
            for file in [old,busy,fresh,unrelated,child]:
                file.write_bytes(b'fixture')
            for file in [old,busy,child]:
                os.utime(file, (time.time()-7200,time.time()-7200))
            preview = run(root)
            self.assertEqual(preview['eligibleFiles'],2)
            self.assertTrue(old.exists())
            with busy.open('rb'):
                result = run(root, apply=True)
            self.assertEqual(result['deletedFiles'],1, result)
            self.assertFalse(old.exists())
            self.assertTrue(busy.exists())
            self.assertTrue(fresh.exists())
            self.assertTrue(unrelated.exists())
            self.assertTrue(child.exists())
            self.assertEqual(len(result['skipped']),1)


if __name__ == '__main__':
    unittest.main()
