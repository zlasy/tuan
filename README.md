# 团团打卡（Flask）

## 本地运行

项目用 [uv](https://docs.astral.sh/uv/) 管理依赖（`pyproject.toml` + `uv.lock`）：

```bash
uv sync          # 创建 .venv 并装好依赖
uv run python app.py
```

浏览器打开 http://127.0.0.1:5001/ （端口 5001；macOS 上 5000 常被「隔空播放接收器」占用，故避开）。如需用手机访问，启动时将 Flask 绑定到局域网地址，并确保手机与电脑在同一网络中。

任务内容编辑 [tasks.json](tasks.json)。`daily` 是每日任务；`assignments` 按布置日期组织不定期任务。每项可打卡任务的 `id` 在其所属日期内应唯一。重启服务即可读取修改后的配置。

打卡数据保存在 `instance/checkins.sqlite3`，按每日日期或不定期任务的布置日期区分。服务使用北京时间计算“今天”。

运行测试：

```bash
uv run python -m unittest discover -s tests -v
```

原先发布的静态站点保留在 `dist/`，不会连接此 Flask 服务或共用 SQLite 状态。要让公开网址使用服务端打卡，需部署 Flask 到支持 Python 服务及持久磁盘的环境。

## nginx 反向代理（HTTP + HTTPS）

配置见 [deploy/nginx.conf](deploy/nginx.conf)，默认转发到 `127.0.0.1:5001`：80 端口除证书续期路径外全部 301 跳转到 443，443 走 TLS 后代理到 Flask。

```bash
# macOS（Homebrew nginx，默认监听 8080）
brew install nginx
cp deploy/nginx.conf /opt/homebrew/etc/nginx/servers/tuan.conf
nginx -t && brew services start nginx

# Linux
sudo cp deploy/nginx.conf /etc/nginx/conf.d/tuan.conf
sudo nginx -t && sudo systemctl reload nginx
```

证书：有域名用 `sudo certbot certonly --webroot -w /var/www/certbot -d 你的域名`；本机自测可生成自签证书（命令与路径见 `deploy/nginx.conf` 文件头）。改完记得同步配置里的 `server_name`、`ssl_certificate*` 与 `location /static/` 的 alias 路径。

## 启停与后台运行

对外服务时不要用 `python app.py`（`debug=True` 会把 Werkzeug 调试器暴露到公网），先装 gunicorn：

```bash
uv add gunicorn          # 写入 pyproject.toml / uv.lock
```

**日常启停**（服务器上就用这两个脚本，路径无关，拉下来直接跑）：

```bash
./restart.sh        # 停旧 → gunicorn 启动 → 轮询 /api/status 等就绪（最多 15 秒）
./restart.sh -f     # 停止阶段强制 SIGKILL
./stop.sh           # 优雅停止（SIGTERM，最多等 10 秒后自动升级 SIGKILL）
./stop.sh -f        # 强制停止
```

可用环境变量：`PORT`（默认 5001）、`WORKERS`（默认 2）、`LOG`（默认 `logs/app.log`）、`PIDFILE`（默认 `.run/app.pid`）。日志看 `logs/app.log`。

两个脚本都以**端口**为判断依据，不看 pidfile —— `uv run → gunicorn → worker` 是一条进程链，只杀一个会留下占着端口的孤儿。`restart.sh` 强制要求 gunicorn；环境里没有会直接报错并给出安装命令，不会退回开发服务器。

**开机自启**（重启机器也不用管），二选一：

```bash
# macOS
cp deploy/com.tuan.checkin.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.tuan.checkin.plist

# Linux
sudo cp deploy/tuan.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now tuan
```

`uv run --no-sync` 表示启动时不再重新解析/安装依赖（快、不需要网络）；环境没建好时它会直接报错，先手工跑一次 `uv sync` 即可。

