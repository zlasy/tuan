import calendar
import json
import sqlite3
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from flask import Flask, current_app, jsonify, render_template, request


BASE = Path(__file__).resolve().parent


def today():
    return datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()


def load_tasks():
    return json.loads(Path(current_app.config["TASK_CONFIG"]).read_text(encoding="utf-8"))


def connection():
    db = sqlite3.connect(current_app.config["DATABASE"])
    db.execute("CREATE TABLE IF NOT EXISTS checkins (task_group TEXT NOT NULL, scope TEXT NOT NULL, task_id TEXT NOT NULL, done INTEGER NOT NULL, PRIMARY KEY (task_group, scope, task_id))")
    return db


def valid_date(value):
    try:
        return date.fromisoformat(value).isoformat() == value
    except (TypeError, ValueError):
        return False


def create_app(config=None):
    app = Flask(__name__)
    app.config.update(TASK_CONFIG=str(BASE / "tasks.json"), DATABASE=str(BASE / "instance" / "checkins.sqlite3"))
    if config:
        app.config.update(config)
    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)

    @app.get("/")
    def index():
        tasks = load_tasks()
        return render_template("index.html", daily=tasks["daily"], assignments=tasks["assignments"], today=today())

    @app.get("/api/status")
    def get_status():
        day = request.args.get("date") or today()
        if not valid_date(day):
            return jsonify(error="日期格式应为 YYYY-MM-DD"), 400
        tasks = load_tasks()
        result = {"daily": {}, "once": {}}
        with connection() as db:
            for group, scope, task_id, done in db.execute("SELECT task_group, scope, task_id, done FROM checkins WHERE (task_group = 'daily' AND scope = ?) OR task_group = 'once'", (day,)):
                result[group][task_id if group == "daily" else f"{scope}:{task_id}"] = bool(done)
        return jsonify(result)

    @app.get("/api/calendar")
    def get_calendar():
        month = request.args.get("month", "")
        if not valid_date(month + "-01"):
            return jsonify(error="月份格式应为 YYYY-MM"), 400
        task_ids = {task["id"] for task in load_tasks()["daily"]}
        completed = {}
        with connection() as db:
            for scope, task_id in db.execute("SELECT scope, task_id FROM checkins WHERE task_group = 'daily' AND done = 1 AND scope LIKE ?", (month + "-%",)):
                completed.setdefault(scope, set()).add(task_id)
        current_day = today()
        days = {}
        for number in range(1, calendar.monthrange(int(month[:4]), int(month[5:]))[1] + 1):
            day = f"{month}-{number:02d}"
            if task_ids and task_ids <= completed.get(day, set()):
                days[day] = "complete"
            elif "2026-10-01" <= day < current_day:
                days[day] = "overdue"
            else:
                days[day] = "pending"
        return jsonify(days=days)

    @app.put("/api/status")
    def put_status():
        body = request.get_json(silent=True) or {}
        group, task_id, day, done = (body.get(key) for key in ("group", "id", "date", "done"))
        if group not in ("daily", "once") or not isinstance(task_id, str) or not valid_date(day) or type(done) is not bool:
            return jsonify(error="无效的打卡数据"), 400
        tasks = load_tasks()
        if group == "daily":
            known = any(task["id"] == task_id for task in tasks["daily"])
        else:
            known = any(assignment["date"] == day and task["id"] == task_id for assignment in tasks["assignments"] for section in assignment["sections"] for task in section["tasks"])
        if not known:
            return jsonify(error="任务不存在"), 400
        scope = day
        with connection() as db:
            db.execute("INSERT INTO checkins (task_group, scope, task_id, done) VALUES (?, ?, ?, ?) ON CONFLICT(task_group, scope, task_id) DO UPDATE SET done = excluded.done", (group, scope, task_id, int(done)))
        return jsonify(group=group, id=task_id, date=day, done=done)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
