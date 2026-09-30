# 团团打卡（Flask）

## 本地运行

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

浏览器打开 http://127.0.0.1:5001/ （端口 5001；macOS 上 5000 常被「隔空播放接收器」占用，故避开）。如需用手机访问，启动时将 Flask 绑定到局域网地址，并确保手机与电脑在同一网络中。

任务内容编辑 [tasks.json](tasks.json)。`daily` 是每日任务；`assignments` 按布置日期组织不定期任务。每项可打卡任务的 `id` 在其所属日期内应唯一。重启服务即可读取修改后的配置。

打卡数据保存在 `instance/checkins.sqlite3`，按每日日期或不定期任务的布置日期区分。服务使用北京时间计算“今天”。

运行测试：

```bash
.venv/bin/python -m unittest discover -s tests -v
```

原先发布的静态站点保留在 `dist/`，不会连接此 Flask 服务或共用 SQLite 状态。要让公开网址使用服务端打卡，需部署 Flask 到支持 Python 服务及持久磁盘的环境。

## nginx 反向代理

配置见 [deploy/nginx.conf](deploy/nginx.conf)，默认转发到 `127.0.0.1:5001`：

```bash
# macOS（Homebrew nginx，默认监听 8080）
brew install nginx
cp deploy/nginx.conf /opt/homebrew/etc/nginx/servers/tuan.conf
nginx -t && brew services start nginx

# Linux
sudo cp deploy/nginx.conf /etc/nginx/conf.d/tuan.conf
sudo nginx -t && sudo systemctl reload nginx
```

对外服务时不要用 `python app.py`（`debug=True` 会暴露调试器），改用：

```bash
.venv/bin/pip install gunicorn
.venv/bin/gunicorn -w 2 -b 127.0.0.1:5001 app:app
```

