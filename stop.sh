#!/usr/bin/env bash
#
# 团团打卡 —— 停止服务（CentOS）
#
#   ./stop.sh        优雅停止（SIGTERM，最多等 10 秒）
#   ./stop.sh -f     强制停止（直接 SIGKILL）
#
# 环境变量：PORT=5001  PIDFILE=.run/app.pid
#
# 判据以「端口」为准：uv run → gunicorn → worker 是一条进程链，只杀父进程
# 会留下占着端口的孤儿，所以谁监听 5001 就收谁。pidfile 只是补充目标，
# 可能已过期（被 kill -9、机器重启过），不能作为「是否在运行」的依据。

set -uo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PORT=${PORT:-5001}
PIDFILE=${PIDFILE:-$DIR/.run/app.pid}

# 找出监听 $PORT 的 PID。ss 是 CentOS 自带（iproute 包）；lsof 兜底是为了
# 在没装 ss 的机器上也能用。注意 ss -p 只在你有权限看该进程时才显示 pid。
# 这里不用 ss 的 -H（免表头），老版本 iproute2 没有这个参数；表头里不会有
# "pid=" 字样，所以不影响 grep 结果。
listener_pids() {
    local out=""
    if command -v ss >/dev/null 2>&1; then
        out=$(ss -ltnp "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 || true)
    fi
    if [ -z "$out" ] && command -v lsof >/dev/null 2>&1; then
        out=$(lsof -nP -ti "TCP:$PORT" -sTCP:LISTEN 2>/dev/null || true)
    fi
    echo $out | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u | tr '\n' ' '
}

port_pids=$(listener_pids)

# ---------- 没在跑：清掉过期 pidfile 就走 ----------
if [ -z "$(echo $port_pids | tr -d ' ')" ]; then
    if [ -f "$PIDFILE" ]; then
        echo "[stop] 端口空闲，清理过期 pidfile（原记 PID $(cat "$PIDFILE" 2>/dev/null || echo '?'))"
        rm -f "$PIDFILE"
    fi
    echo "[stop] 未在运行（端口 $PORT 无监听），无需处理"
    exit 0
fi

# ---------- 停止 ----------
# pidfile 里的主进程排在最前面先杀：gunicorn 的 master 收到 SIGTERM 会主动
# 关掉自己的 worker；反过来先杀 worker 的话，master 会立刻把它拉起来，
# 变成拉锯。这里用 awk 去重而不是 sort -u —— 要保住「master 在前」的顺序。
targets=""
if [ -f "$PIDFILE" ]; then
    pf=$(cat "$PIDFILE" 2>/dev/null || true)
    [ -n "$pf" ] && targets="$pf"
fi
targets="$targets $port_pids"
targets=$(echo $targets | tr ' ' '\n' | grep -E '^[0-9]+$' | awk '!seen[$0]++' | tr '\n' ' ')

echo "[stop] 端口 $PORT 上的进程：${port_pids% }"
if [ -f "$PIDFILE" ]; then
    echo "[stop] 按顺序停止：${targets% }"
fi

force=0
case "${1:-}" in
    -f | --force) force=1 ;;
esac

if [ "$force" = "1" ]; then
    echo "[stop] 强制模式：SIGKILL"
    for p in $targets; do kill -9 "$p" 2>/dev/null || true; done
    sleep 1
else
    echo "[stop] 发送 SIGTERM，等待端口释放……"
    for p in $targets; do kill "$p" 2>/dev/null || true; done

    n=0
    while [ "$n" -lt 20 ]; do
        [ -z "$(listener_pids | tr -d ' ')" ] && break
        n=$((n + 1))
        sleep 0.5
    done

    if [ -n "$(listener_pids | tr -d ' ')" ]; then
        echo "[stop] 10 秒内没退出，升级 SIGKILL"
        for p in $(listener_pids); do kill -9 "$p" 2>/dev/null || true; done
        sleep 1
    fi
fi

rm -f "$PIDFILE"

if [ -n "$(listener_pids | tr -d ' ')" ]; then
    echo "[stop] 失败：端口 $PORT 仍被占用，PID $(listener_pids)" >&2
    exit 1
fi

echo "[stop] 已停止，端口 $PORT 已释放"
