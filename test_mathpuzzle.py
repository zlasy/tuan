import json
from pathlib import Path
import random
import re
import subprocess
import unittest
from fractions import Fraction
from unittest.mock import patch

import mathpuzzle


class MathPuzzleTests(unittest.TestCase):
    def test_generated_puzzles_have_exactly_one_solution(self):
        for top in (50, 100):
            for seed in range(10):
                with self.subTest(top=top, seed=seed):
                    with patch('mathpuzzle.random.Random', return_value=random.Random(seed)):
                        puzzle = mathpuzzle.build_puzzle(top)
                    numbers = {(n['r'], n['c']): n for n in puzzle['numbers']}
                    unknowns = [cell for cell, n in numbers.items() if not n['given']]
                    self.assertTrue(unknowns)
                    self.assertTrue(all(1 <= n['answer'] <= top for n in numbers.values()))
                    rows = []
                    for eq in puzzle['equations']:
                        cells = [tuple(cell) for cell in eq['cells']]
                        a, b, c = [numbers[cell]['answer'] for cell in cells]
                        self.assertEqual(a + b if eq['op'] == '+' else a - b, c)
                        coefficients = dict(zip(cells, (1, 1 if eq['op'] == '+' else -1, -1)))
                        rows.append([Fraction(coefficients.get(cell, 0)) for cell in unknowns])
                    # 满列秩意味着实数范围内也只有一个解；上面已验证该解合法。
                    rank = 0
                    for col in range(len(unknowns)):
                        pivot = next((i for i in range(rank, len(rows)) if rows[i][col]), None)
                        if pivot is None:
                            continue
                        rows[rank], rows[pivot] = rows[pivot], rows[rank]
                        divisor = rows[rank][col]
                        rows[rank] = [v / divisor for v in rows[rank]]
                        for i in range(rank + 1, len(rows)):
                            factor = rows[i][col]
                            rows[i] = [v - factor * p for v, p in zip(rows[i], rows[rank])]
                        rank += 1
                    self.assertEqual(rank, len(unknowns))

    def test_browser_checks_given_numbers_and_input_range(self):
        puzzle = {
            'size': 5, 'top': 50, 'marks': [],
            'numbers': [
                {'r': 0, 'c': 0, 'given': True, 'answer': 3},
                {'r': 0, 'c': 2, 'given': False, 'answer': 4},
                {'r': 0, 'c': 4, 'given': False, 'answer': 7},
            ],
            'equations': [{'op': '+', 'cells': [[0, 0], [0, 2], [0, 4]]}],
        }
        script = re.search(r'<script>(.*?)</script>', Path('templates/game_math.html').read_text(), re.S)[1]
        script = script.replace('{{ puzzle|tojson }}', json.dumps(puzzle))
        harness = '''
const assert = require('node:assert/strict');
function element() { const classes = new Set(); return {style: {}, classList: {
  add(...names){names.forEach(n => classes.add(n))}, remove(...names){names.forEach(n => classes.delete(n))},
  contains(name){return classes.has(name)}, toggle(){}},
  value: '', textContent: '', handlers: {}, replaceChildren(){}, append(){},
  setAttribute(){}, addEventListener(name, fn){this.handlers[name] = fn},
  querySelector(){return element()}, showModal(){}, close(){}}; }
const elements = new Map();
const document = {querySelector(s){if (!elements.has(s)) elements.set(s, element()); return elements.get(s)},
  querySelectorAll(){return []}, createElement: element};
'''
        checks = '''
inputs.get('0,2').value = '4'; inputs.get('0,4').value = '7';
refresh();
assert.equal(progress.textContent, '1 / 1 全部正确！');
document.querySelector('#check').handlers.click();
assert(inputs.get('0,2').classList.contains('correct'));
assert(inputs.get('0,4').classList.contains('correct'));
inputs.get('0,4').value = '8';
inputs.get('0,4').handlers.input();
assert(!inputs.get('0,4').classList.contains('correct'));
document.querySelector('#check').handlers.click();
assert(inputs.get('0,2').classList.contains('wrong'));
assert(inputs.get('0,4').classList.contains('wrong'));
assert(!inputs.get('0,2').classList.contains('correct'));
inputs.get('0,4').value = '7';
document.querySelector('#check').handlers.click();
assert(inputs.get('0,4').classList.contains('correct'));
assert(!inputs.get('0,4').classList.contains('wrong'));
const wrongEquation = {...data.equations[0], op: '-'};
for (const first of [true, false]) {
  if (first) data.equations.unshift(wrongEquation); else data.equations.push(wrongEquation);
  document.querySelector('#check').handlers.click();
  assert(inputs.get('0,2').classList.contains('wrong'));
  assert(!inputs.get('0,2').classList.contains('correct'));
  if (first) data.equations.shift(); else data.equations.pop();
}
inputs.get('0,4').value = '';
document.querySelector('#check').handlers.click();
assert(!inputs.get('0,2').classList.contains('correct'));
assert(!inputs.get('0,4').classList.contains('wrong'));
inputs.get('0,2').value = '51'; inputs.get('0,4').value = '54';
refresh();
assert.equal(progress.textContent, '正确 0 / 1 道算式');
'''
        result = subprocess.run(['node', '-e', harness + script + checks], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
