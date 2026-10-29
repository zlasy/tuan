"""《吞吞鱼》六关题库：短题干、同类干扰项、本地判题。"""
import json
import random
from pathlib import Path

VOCAB = json.loads(Path(__file__).with_name('fish_vocab.json').read_text(encoding='utf-8'))
SUBJECTS = ('chinese', 'english', 'math')


def build_question(level, subject, rng=None):
    rng = rng or random
    if subject != 'math':
        item = dict(rng.choice([q for q in VOCAB[subject] if q['level'] == level]))
    elif rng.random() < .35:
        item = dict(rng.choice([q for q in VOCAB['math'] if q['level'] == level]))
    else:
        if level < 3:
            a = rng.randint(2, 19)
            b = rng.randint(1, 20 - a)
            op = rng.choice(('+', '−'))
            if op == '−':
                a, b = max(a, b), min(a, b)
        elif level < 5:
            # Both addition and subtraction stay in 50–100, with no carrying/borrowing.
            a = rng.randint(5, 8) * 10 + rng.randint(1, 8)
            op = rng.choice(('+', '−'))
            b = rng.randint(1, 9 - a % 10) if op == '+' else rng.randint(1, a % 10)
            if (op == '+' and a < 80) or (op == '−' and a >= 70):
                b += 10
        else:
            op = rng.choice(('+', '−'))
            # Level 5–6 deliberately practice carrying and borrowing within 100.
            if op == '+':
                a = rng.randint(4, 7) * 10 + rng.randint(2, 9)
                b = rng.randint(10 - a % 10, 9) + 10
            else:
                a = rng.randint(7, 9) * 10 + rng.randint(0, 7)
                b = rng.randint(a % 10 + 1, 9) + 10
        answer = a + b if op == '+' else a - b
        item = {'id': f'math-{a}-{op}-{b}', 'level': level, 'prompt': f'{a} {op} {b} = ？',
                'answer': str(answer), 'options': [str(answer), str(answer + 1), str(answer - 1), str(answer + 10)],
                'explanation': ('满十向十位进一' if op == '+' else '借一当十再相减') if level >= 5 else ('相同数位对齐计算' if level >= 3 else '加法往后数，减法往前数')}
    options = [item['answer']] + rng.sample([x for x in item['options'] if x != item['answer']], 2 if level < 3 else 3)
    rng.shuffle(options)
    return {**item, 'subject': subject, 'options': options}


def build_questions(level, attempt=0, weak=(), exclude=(), rng=None):
    rng = rng or random
    count = [3, 3, 3, 4, 4, 5][level - 1]
    subjects = list(SUBJECTS) + rng.sample(SUBJECTS, count - 3)
    if attempt >= 2:
        subjects = rng.choices(SUBJECTS, weights=[.5 if s in weak else 1 for s in SUBJECTS], k=count)
    questions = []
    seen = set(exclude)
    for subject in subjects:
        for _ in range(100):
            question = build_question(max(1, level - (attempt >= 2)), subject, rng)
            if question['id'] not in seen:
                break
        questions.append(question)
        seen.add(question['id'])
    rng.shuffle(questions)
    return questions
