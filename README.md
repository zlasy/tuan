# 云泽打卡（Flask）

## 本地运行

项目用 [uv](https://docs.astral.sh/uv/) 管理依赖（`pyproject.toml` + `uv.lock`）：

```bash
uv sync          # 创建 .venv 并装好依赖
uv run python app.py
```

浏览器打开 http://127.0.0.1:5001/ （端口 5001；macOS 上 5000 常被「隔空播放接收器」占用，故避开）。如需用手机访问，启动时将 Flask 绑定到局域网地址，并确保手机与电脑在同一网络中。

任务内容编辑 [tasks.json](tasks.json)。`daily` 是每日任务；`assignments` 按布置日期组织不定期任务。每项可打卡任务的 `id` 在其所属日期内应唯一。重启服务即可读取修改后的配置。

打卡数据保存在 `instance/checkins.sqlite3`，按每日日期或不定期任务的布置日期区分。服务使用北京时间计算“今天”。

## 管理员登录

未登录时可查看所有任务与打卡状态，勾选框置灰；登录后才可修改每日任务和不定期任务，退出后恢复只读。登录有效期为 8 小时。

项目从根目录 `.env` 读取管理员配置，启动前无需手动 `export`。当前本地 `.env` 已生成账号、随机密码和会话密钥；账号默认 `admin`，密码请在 `.env` 中查看或修改。

新环境首次部署：

```bash
cp .env.example .env
# 编辑 .env，填写 ADMIN_USERNAME、ADMIN_PASSWORD、SECRET_KEY
uv sync
./restart.sh
```

可用 `python3 -c 'import secrets; print(secrets.token_hex(32))'` 生成 `SECRET_KEY`，生成后固定保存供各 worker 和后续重启共用。配置优先级为：应用显式配置 > 系统环境变量 > `.env`。修改 `.env` 后需重启服务；缺少任一登录配置时，打卡保持只读，登录页提示尚未配置。

`.env` 已加入 Git 忽略规则，仅提交不含密码和密钥的 `.env.example`。
首页点击「管理员登录」输入账号密码即可；密码不保存在代码或浏览器存储中。后端同时校验登录状态与 CSRF 令牌，拒绝未登录或无效页面提交的修改。

## 小游戏

- **吞吞鱼**（`/games/fish`）：六个海域为浅滩珊瑚、海草森林、沉船区、深海峡谷、鲸落、海底火山，成长阈值依次为 30 / 50 / 70 / 90 / 120 / 150。前三关三题答对两题，第四、五关四题答对三题，第六关五题答对三题。答错显示讲解，可立即进入下一题；失败后再吃 10 点重试，第三次完成所有题目保底晋级。

单指拖动或方向键游动；鱼群具有立体光影、条纹、摆尾和鱼鳍细节，水母带透明触须和起伏动作。六个海域拥有独立配色与场景。深水成长值增加 30%，水母数量翻倍；受伤损失当前成长值的 20%，获得 1.5 秒保护。含连吃倍率、限时金鱼、两种可关闭提示音。进度只存在当前浏览器；旧三关通关存档自动接续第四关，未完成存档保持原进度。暂停或切到后台暂停题目计时。本次扩展不含语音、图鉴、错题本和家长报告。

题库位于 `fish_vocab.json`（每科 60 道静态题，共 180 道），`fishquiz.py` 另生成数学题，第五、六关练习 100 以内进退位。接口 `/api/games/fish/questions?level=1` 按关卡返回三至五题，附加 `subject=chinese|english|math` 可获取指定学科一题。运行测试：`python -m unittest test_fishquiz`、`node --test test_fish.cjs`。关卡时长和儿童体验仍需实际试玩验证。

首页第三个 tab「🎮 小游戏」是游戏列表，后续会陆续添加。当前包含：

- **数学思维 · 交叉算式**（`/games/math`）：仿照纸质《20以内加减法交叉思维练习》，在 13×13 网格中填数使横、纵共 18 道算式成立，支持 50 以内 / 100 以内切换。谜题由 `mathpuzzle.py` 实时生成（链式回溯求解，补足提示使所有空格可逐步推导，保证每题有且仅有一个解），前端本地判题，`/api/games/math/puzzle?top=50` 可直接取新题。
- **英语单词 · 闪卡**（`/games/words`）：369 个单词及短语、40 个常见句式，按 20 个主题分类，每轮随机抽 10 张。支持翻面、英文朗读和未掌握卡片复习。词库位于 `wordcards.py`，面向一、二年级，以 Power Up 1–2、RAZ aa–J、牛津树 1–5 级为选词范围参考；这是精选练习词库，例句自编，不是各教材逐册完整词表。参考 [Power Up 2 课程大纲](https://www.cambridge.org/us/files/3815/6768/5029/Power_Up_Power_Up_L2_Scope_And_Sequence_9781108413763_Scope_and_Sequence.pdf)、[Reading A-Z 阅读技能表](https://www.readinga-z.com/helpful-tools/books-by-skills-chart/)、[牛津树级别说明](https://home.oxfordowl.co.uk/reading/reading-schemes-oxford-levels/oxford-reading-tree-levels/)。

- **小灯塔分级阅读**（`/games/lighthouse`）：第 5 个游戏，面向 6–8 岁，手机竖屏优先。蓝海 / 绿野 / 金山三级各 13 本原创试读故事（共 39 本、234 页），提供设备英文范读、逐词发音与中文提示、收藏、自动续读、重读、完成度一星与灯塔点亮、里程碑徽章、本周日历、同设备共读及家长本地周报。阅读设置支持语速、字号和高对比度。

小灯塔本版按确认范围暂不提供录音：翻完全书并合书获得 1 星，不评判发音，不模拟录音得分；2–3 星留待录音功能接入。每本首次读完点亮一格，重读保留星级，不重复点亮。亲子邀请指邀请身边家人共用当前设备，不发送消息、不涉及账号或联网入座。进度与收藏仅保存在当前浏览器的 `localStorage`，清理站点数据会丢失，不与打卡数据库同步。

内容位于 `lighthouse_books.json`，词义位于 `lighthouse_vocab.json`；均为试读素材，尚未经教学分级审定，画面使用场景图标辅助。范读使用浏览器 SpeechSynthesis 的英文声音（优先设备本地声音），没有可用声音时显示提示并保留阅读。周报在家长小窗按北京时间自然周汇总，不向外发送；收藏 Top 3 基于当前收藏及该周读完次数。

运行测试：

```bash
uv run python -m unittest discover -v
uv run python -m unittest discover -s tests -v
node --test test_lighthouse.cjs tests/*.cjs
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

