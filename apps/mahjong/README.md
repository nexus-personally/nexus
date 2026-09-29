# NEXUS SYSTEM 02 · 港雀

麻将作为 NEXUS 同一域名下的 `/mahjong/` 页面运行。前端由 Vite 构建；NEXUS 的 Fastify 服务提供静态文件、`/mahjong/api/*` 账号接口和 `/mahjong/ws` 房间连接。

在 Render 上复用 NEXUS 的 `DATABASE_URL`，自动建立 `mahjong_accounts` 与 `mahjong_sessions` 表。无需新建数据库。现有本机麻将账号文件不会上传，线上账号需要重新注册；也不要将 `server/data/accounts.json` 加入 Git。

房间、未完成牌局与电脑操作计时器目前保存在服务进程内。Render 重新部署或实例重启会结束正在进行的房间；已注册账号与登录会话保存在 PostgreSQL。
