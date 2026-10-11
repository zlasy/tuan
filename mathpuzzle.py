"""交叉算式谜题生成器（数学思维小游戏）。

结构仿照纸质练习册：13×13 网格上横、纵各若干条算式交叉，
相邻算式共享数字格。每道算式形如 a + b = c（或 a - b = c），
所有数字都落在 1~top 之间（默认 40 以内加减法）。

生成流程：先随机确定每道算式的运算符，再用带回溯的链式搜索
为所有数字格赋值（保证每条算式都成立），最后按「每道算式至少
露出一个数字」的策略挖空，得到可玩谜题。
"""
import random

SIZE = 13  # 网格边长

# 18 道算式的锚点（方向, 行, 列），即每道算式第一个数字所在格。
# 与纸质练习册版式一致：横向算式在第 0/4/8/12 行，纵向算式在第 0/4/8/12 列。
ANCHORS = (
    ("h", 0, 0), ("h", 0, 8),
    ("h", 4, 0), ("h", 4, 4), ("h", 4, 8),
    ("h", 8, 4), ("h", 8, 8),
    ("h", 12, 0), ("h", 12, 4),
    ("v", 0, 0), ("v", 4, 0),
    ("v", 0, 4), ("v", 8, 4),
    ("v", 0, 8), ("v", 4, 8), ("v", 8, 8),
    ("v", 4, 12), ("v", 8, 12),
)


def _number_cells(direction, row, col):
    """一道算式三个数字格的坐标，依次为 a、b、c。"""
    if direction == "h":
        return (row, col), (row, col + 2), (row, col + 4)
    return (row, col), (row + 2, col), (row + 4, col)


def _options(op, fixed, top):
    """枚举一道算式在已知数字约束下的全部可行解 (a, b, c)。"""
    a, b, c = fixed.get("a"), fixed.get("b"), fixed.get("c")
    result = []
    if a is not None and b is not None:
        value = a + b if op == "+" else a - b
        if c is None:
            if 1 <= value <= top:
                result.append((a, b, value))
        elif value == c:
            result.append((a, b, c))
    elif a is not None and c is not None:
        other = c - a if op == "+" else a - c
        if 1 <= other <= top:
            result.append((a, other, c))
    elif b is not None and c is not None:
        other = c - b if op == "+" else b + c
        if 1 <= other <= top:
            result.append((other, b, c))
    elif a is not None:
        for other in range(1, top + 1):
            value = a + other if op == "+" else a - other
            if 1 <= value <= top:
                result.append((a, other, value))
    elif b is not None:
        for other in range(1, top + 1):
            value = other + b if op == "+" else other - b
            if 1 <= value <= top:
                result.append((other, b, value))
    elif c is not None:
        for other in range(1, top + 1):
            rest = c - other if op == "+" else other - c
            if 1 <= rest <= top:
                result.append((other, rest, c))
    else:
        for x in range(1, top + 1):
            for y in range(1, top + 1):
                value = x + y if op == "+" else x - y
                if 1 <= value <= top:
                    result.append((x, y, value))
    return result


def _order(anchors, rng):
    """把算式排成一条链：尽量让每道算式与前面已确定的共享数字格。"""
    equations = [{"index": i, "cells": _number_cells(d, r, c)} for i, (d, r, c) in enumerate(anchors)]
    placed, order, pending = set(), [], equations[:]
    while pending:
        pending.sort(key=lambda item: (-len(set(item["cells"]) & placed), rng.random()))
        chosen = pending.pop(0)
        order.append(chosen)
        placed.update(chosen["cells"])
    return order


def _solve(order, ops, top, rng):
    """链式回溯求解：给所有数字格赋值，使每道算式都成立。"""
    values, steps = {}, 0

    def assign(position):
        nonlocal steps
        if position == len(order):
            return True
        equation = order[position]
        a_cell, b_cell, c_cell = equation["cells"]
        fixed, fixed_cells = {}, set()
        for name, cell in (("a", a_cell), ("b", b_cell), ("c", c_cell)):
            if cell in values:
                fixed[name] = values[cell]
                fixed_cells.add(cell)
        options = _options(ops[equation["index"]], fixed, top)
        rng.shuffle(options)
        for a, b, c in options:
            values[a_cell], values[b_cell], values[c_cell] = a, b, c
            steps += 1
            if steps > 100_000:
                return False
            if assign(position + 1):
                return True
            for cell in (a_cell, b_cell, c_cell):
                if cell not in fixed_cells:
                    del values[cell]
        return False

    return values if assign(0) else None


def build_puzzle(top=40):
    """生成一题完整谜题，返回可直接交给前端的字典。"""
    if top not in (20, 40):
        top = 40
    rng = random.Random()
    order = _order(ANCHORS, rng)
    ops = None
    for _ in range(80):
        ops = [rng.choice("+-") for _ in ANCHORS]
        values = _solve(order, ops, top, rng)
        if values is not None:
            break
    else:
        raise RuntimeError("无法生成有效谜题")

    # 挖空：先保证每道算式至少露出一个数字，再随机多露出一些
    revealed = set()
    equation_cells = [_number_cells(d, r, c) for d, r, c in ANCHORS]
    for cells in rng.sample(equation_cells, len(equation_cells)):
        if not set(cells) & revealed:
            revealed.add(rng.choice(cells))
    for cell in values:
        if cell not in revealed and rng.random() < 0.2:
            revealed.add(cell)

    numbers, marks, equations = [], [], []
    for index, (direction, row, col) in enumerate(ANCHORS):
        a, b, c = _number_cells(direction, row, col)
        op_row, op_col = (row, col + 1) if direction == "h" else (row + 1, col)
        eq_row, eq_col = (row, col + 3) if direction == "h" else (row + 3, col)
        marks.append({"r": op_row, "c": op_col, "text": ops[index]})
        marks.append({"r": eq_row, "c": eq_col, "text": "="})
        equations.append({"op": ops[index], "cells": [list(cell) for cell in (a, b, c)]})
    for (row, col), answer in sorted(values.items()):
        given = (row, col) in revealed
        numbers.append({"r": row, "c": col, "answer": answer, "given": given, "value": answer if given else None})
    return {"size": SIZE, "top": top, "count": len(ANCHORS), "numbers": numbers, "marks": marks, "equations": equations}
