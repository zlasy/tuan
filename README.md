# 团团打卡（Flask）

## 本地运行

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

浏览器打开 http://127.0.0.1/ （端口 80）。如需用手机访问，启动时将 Flask 绑定到局域网地址，并确保手机与电脑在同一网络中。

任务内容编辑 [tasks.json](tasks.json)。`daily` 是每日任务；`assignments` 按布置日期组织不定期任务。每项可打卡任务的 `id` 在其所属日期内应唯一。重启服务即可读取修改后的配置。

打卡数据保存在 `instance/checkins.sqlite3`，按每日日期或不定期任务的布置日期区分。服务使用北京时间计算“今天”。

运行测试：

```bash
.venv/bin/python -m unittest discover -s tests -v
```

原先发布的静态站点保留在 `dist/`，不会连接此 Flask 服务或共用 SQLite 状态。要让公开网址使用服务端打卡，需部署 Flask 到支持 Python 服务及持久磁盘的环境。
