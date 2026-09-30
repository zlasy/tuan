#!/usr/bin/env bash
#
# 团团打卡 —— 重启服务（CentOS）
#
#   ./restart.sh        停止旧进程 → 启动 → 等就绪
#   ./restart.sh -f     停止阶段强制 SIGKILL
#
# 环境变量：PORT=5001  WORKERS=2  LOG=logs/app.log  PIDFILE=.run/app.pid
#
# 服务器上固定用 gunicorn。app.py 里是 debug=True 的 Flask 开发服务器，
# 直接对外等于把 Werkzeug 调试器挂到公网（可被利用执行任意代码），
# 所以这里不给回退分支。没装就先去装：
#     uv add gunicorn
#
# 就绪判据用 /api/status —— 这个路径只存在于 Flask 里；用 / 判断不了，
# 因为 nginx 默认首页/静态根目录也会返回 200。
# curl 必须带 --noproxy '*'：机器上若有 HTTP_PROXY，curl 会绕道代理访问
# 127.0.0.1，拿到 502 之类的假响应。

set -uo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PORT=${PORT:-5001}
WORKERS=${WORKERS:-2}
LOG=${LOG:-$DIR/logs/app.log}
PIDFILE=${PIDFILE:-$DIR/.run/app.pid}

echo "[restart] 检查环境……"

command -v uv >/dev/null 2>&1 || {
    echo "[restart] 失败：找不到 uv，先安装：https://docs.astral.sh/uv/" >&2
    exit 1
}

# ---------- 1. 停旧 ----------
if [ -x "$DIR/stop.sh" ]; then
    "$DIR/stop.sh" "${1:-}" || {
        echo "[restart] 失败：旧进程没停干净，先手动处理" >&2
        exit 1
    }
else
    echo "[restart] 警告：没有可执行的 stop.sh，跳过停止阶段"
fi

# ---------- 2. 保证 .venv 存在（--no-sync 在环境缺失时会直接报错）----------
if [ ! -d "$DIR/.venv" ]; then
    echo "[restart] 未找到 .venv，执行 uv sync ……"
    (cd "$DIR" && uv sync) || {
        echo "[restart] 失败：uv sync 没成功" >&2
        exit 1
    }
fi

# ---------- 3. 确认 gunicorn 已装 ----------
if ! (cd "$DIR" && uv run --no-sync python -c "import gunicorn" >/dev/null 2>&1); then
    echo "[restart] 失败：环境里没有 gunicorn。先执行：" >&2
    echo "             cd $DIR && uv add gunicorn" >&2
    exit 1
fi

# ---------- 4. 后台启动 ----------
mkdir -p "$(dirname "$LOG")" "$(dirname "$PIDFILE")"
cd "$DIR" || exit 1

echo "[restart] 启动 gunicorn（$WORKERS workers），日志 $LOG"
cmd=(uv run --no-sync gunicorn -w "$WORKERS" -b "127.0.0.1:$PORT" --access-logfile - app:app)

if command -v setsid >/dev/null 2>&1; then
    setsid nohup "${cmd[@]}" >>"$LOG" 2>&1 &
else
    nohup "${cmd[@]}" >>"$LOG" 2>&1 &
fi
pid=$!
echo "$pid" >"$PIDFILE"
disown 2>/dev/null || true

# ---------- 5. 等就绪 ----------
echo "[restart] PID $pid 已派生，等待 /api/status 就绪（最多 15 秒）……"

# 端口上有没有监听者（不加 -p，任何用户都能查；也不用 -H，老 iproute2 没这参数）
port_busy() {
    if command -v ss >/dev/null 2>&1; then
        ss -ltn "sport = :$PORT" 2>/dev/null | grep -q ":$PORT"
    else
        lsof -nP -ti "TCP:$PORT" -sTCP:LISTEN >/dev/null 2>&1
    fi
}

n=0
while [ "$n" -lt 30 ]; do
    if curl -fsS -o /dev/null --max-time 2 --noproxy '*' "http://127.0.0.1:$PORT/api/status" >/dev/null 2>&1; then
        echo "[restart] 启动成功 → http://127.0.0.1:$PORT/（PID ${pid}）"
        exit 0
    fi
    # $pid 死了且端口也没人听 → 确实是起不来，立刻报错不用等满 15 秒。
    # 两个条件都要，因为 setsid 在个别情形下会 fork，$pid 可能不是真正的进程。
    if ! kill -0 "$pid" 2>/dev/null && ! port_busy; then
        echo "[restart] 失败：进程已退出，日志尾部：" >&2
        tail -n 20 "$LOG" >&2
        rm -f "$PIDFILE"
        exit 1
    fi
    n=$((n + 1))
    sleep 0.5
done

echo "[restart] 失败：15 秒内 /api/status 没就绪，日志尾部：" >&2
tail -n 20 "$LOG" >&2
rm -f "$PIDFILE"
exit 1
