import random
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import create_app
from wordcards import build_deck


class WordLearningTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.database = str(Path(directory.name) / 'learning.sqlite3')
        self.config = {'TESTING': True, 'DATABASE': self.database}
        self.client = create_app(self.config).test_client()

    def answer(self, correct, round_id='round-1', word='cat', attempt=1):
        return self.client.post('/api/games/words/answer', json=dict(
            word=word, correct=correct, round_id=round_id, attempt=attempt))

    def test_once_per_round_wrong_wins_and_retries_are_idempotent(self):
        self.assertEqual(self.answer(False).json['weight'], 6)
        self.assertEqual(self.answer(False).json['weight'], 6)
        self.assertEqual(self.answer(False, attempt=2).json['weight'], 6)
        self.assertEqual(self.answer(True, attempt=3).json['weight'], 6)
        rows = self.client.get('/api/games/words/mistakes').json['cards']
        self.assertEqual(rows[0]['mistakes'], 2)
        self.assertEqual(self.answer(True, 'round-2').json['weight'], 3)

    def test_correct_then_wrong_replaces_round_outcome(self):
        self.assertEqual(self.answer(True).json['weight'], 1.5)
        self.assertEqual(self.answer(False, attempt=2).json['weight'], 6)
        self.assertEqual(self.answer(True, attempt=3).json['weight'], 6)

    def test_wrong_wins_when_retry_changes_answer_after_lost_response(self):
        self.assertEqual(self.answer(True).json['weight'], 1.5)
        self.assertEqual(self.answer(False).json['weight'], 6)
        self.assertEqual(self.answer(False).json['weight'], 6)
        self.assertEqual(self.client.get('/api/games/words/mistakes').json['cards'][0]['mistakes'], 1)

    def test_bounds_and_persistence_for_phrases(self):
        for i in range(5):
            result = self.answer(True, f'correct-{i}', 'Can you ...?')
        self.assertEqual(result.json['weight'], .5)
        self.client = create_app(self.config).test_client()
        self.assertEqual(self.answer(False, 'next', 'Can you ...?').json['weight'], 1)
        for i in range(6):
            result = self.answer(False, f'wrong-{i}')
        self.assertEqual(result.json['weight'], 12)

    def test_page_and_api_use_saved_weights(self):
        self.answer(False)
        with patch('app.wordcards.build_deck', wraps=build_deck) as build:
            self.assertEqual(self.client.get('/games/words').status_code, 200)
            self.assertEqual(build.call_args.kwargs['weights']['cat'], 6)
            self.assertEqual(self.client.get('/api/games/words/deck').status_code, 200)
            self.assertEqual(build.call_args.kwargs['weights']['cat'], 6)

    def test_invalid_answers(self):
        valid = dict(word='cat', correct=True, round_id='r', attempt=1)
        for changes in ({'word': 'unknown'}, {'correct': 1}, {'round_id': ''},
                        {'round_id': []}, {'attempt': 0}, {'attempt': True}):
            response = self.client.post('/api/games/words/answer', json={**valid, **changes})
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.post('/api/games/words/answer', json=[]).status_code, 400)


class WeightedDeckTests(unittest.TestCase):
    def test_weighted_draw_has_no_duplicates_and_respects_category(self):
        with patch('wordcards.random.choices', wraps=random.Random(42).choices):
            hits = {'cat': 0, 'dog': 0}
            for _ in range(300):
                deck = build_deck('animals', weights={'cat': 12, 'dog': .5})
                words = [card['word'] for card in deck['cards']]
                self.assertEqual(len(words), 10)
                self.assertEqual(len(set(words)), 10)
                for word in hits:
                    hits[word] += word in words
            self.assertGreater(hits['cat'], hits['dog'] * 3)
