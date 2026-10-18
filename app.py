import calendar
import hmac
import json
import os
import secrets
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import dotenv_values
from flask import Flask, current_app, jsonify, redirect, render_template, request, session, url_for

import mathpuzzle
import wordcards


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
    env = {**dotenv_values(BASE / ".env", interpolate=False), **os.environ}
    app.config.update(TASK_CONFIG=str(BASE / "tasks.json"), DATABASE=str(BASE / "instance" / "checkins.sqlite3"))
    app.config.update(SECRET_KEY=env.get("SECRET_KEY"),
                      ADMIN_USERNAME=env.get("ADMIN_USERNAME", ""),
                      ADMIN_PASSWORD=env.get("ADMIN_PASSWORD", ""),
                      PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
                      SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")
    if config:
        app.config.update(config)
    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)

    def auth_configured():
        return all(app.config.get(key) for key in ("SECRET_KEY", "ADMIN_USERNAME", "ADMIN_PASSWORD"))

    def logged_in():
        return auth_configured() and session.get("admin") == app.config["ADMIN_USERNAME"]

    def csrf_token():
        if not auth_configured():
            return ""
        if "csrf_token" not in session:
            session["csrf_token"] = secrets.token_urlsafe(32)
        return session["csrf_token"]

    def valid_csrf():
        expected = session.get("csrf_token", "")
        supplied = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token", "")
        return bool(expected) and hmac.compare_digest(expected.encode(), supplied.encode())

    @app.after_request
    def prevent_auth_caching(response):
        if request.path in ("/", "/login", "/logout", "/api/status"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.route("/login", methods=["GET", "POST"])
    def login():
        wants_json = request.accept_mimetypes.best == "application/json"
        if not auth_configured():
            if wants_json:
                return jsonify(error="管理员登录尚未配置，请联系维护者。"), 503
            return render_template("login.html", error="管理员登录尚未配置，请联系维护者。", configured=False), 503
        error, status = None, 200
        if request.method == "POST":
            if not valid_csrf():
                error, status = "页面已过期，请重新登录。", 403
            else:
                username = request.form.get("username", "")
                password = request.form.get("password", "")
                username_ok = hmac.compare_digest(username.encode(), app.config["ADMIN_USERNAME"].encode())
                password_ok = hmac.compare_digest(password.encode(), app.config["ADMIN_PASSWORD"].encode())
                if username_ok and password_ok:
                    session.clear()
                    session["admin"] = app.config["ADMIN_USERNAME"]
                    session.permanent = True
                    if wants_json:
                        return jsonify(ok=True)
                    return redirect(url_for("index"))
                error, status = "账号或密码错误。", 401
        if wants_json and error:
            return jsonify(error=error), status
        return render_template("login.html", error=error, configured=True, csrf_token=csrf_token()), status

    @app.post("/logout")
    def logout():
        if not valid_csrf():
            return jsonify(error="页面已过期，请刷新后重试。"), 403
        session.clear()
        return redirect(url_for("index"))

    @app.get("/")
    def index():
        tasks = load_tasks()
        return render_template("index.html", daily=tasks["daily"], assignments=tasks["assignments"],
                               today=today(), logged_in=logged_in(), csrf_token=csrf_token())

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
        if not logged_in():
            return jsonify(error="请先登录后再修改打卡。"), 401
        if not valid_csrf():
            return jsonify(error="页面已过期，请刷新后重试。"), 403
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

    @app.get("/games/math")
    def game_math():
        top = 100 if request.args.get("top") == "100" else 50
        return render_template("game_math.html", puzzle=mathpuzzle.build_puzzle(top))

    @app.get("/api/games/math/puzzle")
    def math_puzzle_api():
        top = 100 if request.args.get("top") == "100" else 50
        return jsonify(mathpuzzle.build_puzzle(top))

    @app.get("/games/words")
    def game_words():
        return render_template("game_words.html", deck=wordcards.build_deck(request.args.get("category")), categories=wordcards.CATEGORIES)

    @app.get("/api/games/words/deck")
    def words_deck_api():
        return jsonify(wordcards.build_deck(request.args.get("category")))

    @app.get("/games/reading")
    def game_reading():
        lessons = json.loads((BASE / "reading_lessons.json").read_text(encoding="utf-8"))
        return render_template("game_reading.html", lessons=lessons)

    @app.get("/games/speech")
    def game_speech():
        return render_template("game_speech.html")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
