import tempfile
import unittest
from pathlib import Path

from app import create_app


class WordMistakesTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.config = {"TESTING": True, "DATABASE": str(Path(self.directory.name) / "test.sqlite3")}
        self.client = create_app(self.config).test_client()

    def test_records_words_and_phrases_and_persists_across_clients(self):
        for word in ("cat", "Can you ...?", "cat"):
            self.assertEqual(self.client.post('/api/games/words/mistakes', json={"word": word}).status_code, 200)
        rows = create_app(self.config).test_client().get('/api/games/words/mistakes').json['cards']
        self.assertEqual(len(rows), 2)
        entries = {row['word']: row for row in rows}
        self.assertEqual(entries['cat']['mistakes'], 2)
        self.assertEqual(entries['Can you ...?']['kind'], 'phrase')
        self.assertTrue(entries['cat']['last_wrong'])
        self.assertTrue(entries['cat']['example_cn'])

    def test_remove_only_requested_card_and_allow_relearning(self):
        for word in ('cat', 'dog'):
            self.client.post('/api/games/words/mistakes', json={'word': word})
        self.assertEqual(self.client.delete('/api/games/words/mistakes', json={'word': 'cat'}).status_code, 200)
        rows = self.client.get('/api/games/words/mistakes').json['cards']
        self.assertEqual([row['word'] for row in rows], ['dog'])
        self.client.post('/api/games/words/mistakes', json={'word': 'cat'})
        entries = {row['word']: row for row in self.client.get('/api/games/words/mistakes').json['cards']}
        self.assertEqual(entries['cat']['mistakes'], 1)

    def test_invalid_payloads_do_not_write(self):
        for payload in ({}, [], {'word': []}, {'word': 'not a real card'}):
            self.assertEqual(self.client.post('/api/games/words/mistakes', json=payload).status_code, 400)
        self.assertEqual(self.client.get('/api/games/words/mistakes').json['cards'], [])
