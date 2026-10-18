import json
import re
import tempfile
import unittest
from pathlib import Path
from app import create_app


class LighthouseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.client = create_app({'TESTING': True, 'DATABASE': str(Path(self.tmp.name) / 'test.sqlite3')}).test_client()

    def test_fifth_game_and_reader_are_public(self):
        self.assertIn('/games/lighthouse', self.client.get('/').text)
        response = self.client.get('/games/lighthouse')
        self.assertEqual(response.status_code, 200)
        self.assertIn('本版不录音、不评分', response.text)
        self.assertNotIn('getUserMedia', response.text)
        for filename in ['lighthouse.css', 'lighthouse-core.js', 'lighthouse.js']:
            with self.client.get('/static/' + filename) as asset:
                self.assertEqual(asset.status_code, 200)

    def test_every_word_has_help_and_every_page_has_picture_cues(self):
        page = self.client.get('/games/lighthouse').text
        books = json.loads(re.search(r'id="book-data"[^>]*>(.*?)</script>', page, re.S)[1])
        vocab = json.loads(re.search(r'id="vocab-data"[^>]*>(.*?)</script>', page, re.S)[1])
        self.assertEqual(len(books), 39)
        for book in books:
            self.assertEqual(len(book['pages']), 6)
            for p in book['pages']:
                self.assertTrue(p['hint'] and p['scene'])
                for word in re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", p['text']):
                    self.assertTrue(vocab[word.lower()]['meaning'], word)
