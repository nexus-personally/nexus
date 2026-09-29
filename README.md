# NEXUS：从本机运行到 Render 部署、查看数据库

NEXUS 首页有两个可用入口：System 01 是 Resume Studio，System 02 是「港雀」麻将。当前线上网站：[NEXUS](https://nexus-2rwr.onrender.com/)；麻将也可[直接打开](https://nexus-2rwr.onrender.com/mahjong/)。代码在 [GitHub 仓库](https://github.com/nexus-personally/nexus)。

以下以 **Windows + PowerShell** 为例，按顺序写给第一次接触这类项目的人。本文说的「项目根目录」，就是能看到 `package.json`、`render.yaml`、`Dockerfile` 的文件夹。在资源管理器打开该文件夹，点击上方地址栏，输入 `powershell` 后按 Enter，就能在正确位置打开终端。

## 先分清本机与线上

| 打开的地址 | 实际用到的数据 |
| --- | --- |
| `http://localhost:3000/` | 自己电脑的本机数据 |
| `https://nexus-2rwr.onrender.com/` | Render 的线上 `nexus-db` |

`localhost` 就是你正在用的电脑。本机注册的麻将帐号不会自动出现在网上，网上的帐号也不会自动出现在本机。线上 NEXUS 和麻将**共用**现有的 `nexus-db`，无需另开一个数据库。麻将帐号存于 `mahjong_accounts`，登录会话存于 `mahjong_sessions`；房间、未完成牌局、人机计时器目前保存在服务器记忆体中，**不在数据库里**。Render 重新部署或服务器重启后，正在进行的房间会结束。

## 第 1 步：安装需要的工具

1. 安装 [Git for Windows](https://git-scm.com/download/win)、[Node.js](https://nodejs.org/en/download) **24 或更新版本**、[Docker Desktop](https://www.docker.com/products/docker-desktop/)。Docker 用来启动本机 PostgreSQL 数据库。
2. 打开 Docker Desktop，等它显示已启动。首次打开若要求安装 WSL 2，按其提示完成。
3. 重新打开 PowerShell，逐条执行：

   ```powershell
   git --version
   node --version
   npm --version
   docker --version
   ```

   每条都应显示版本号。本仓库要求 Node.js 24+、npm 11+。若出现「找不到命令」，先检查软件是否安装完成，再重新打开 PowerShell。

> 不想用 Docker 的话，可以安装 PostgreSQL 18，并按下方「不用 Docker」的小节操作；第一次运行建议使用 Docker。

## 第 2 步：在本机运行完整的 NEXUS 和麻将

1. 没下载项目的人，先在希望放置项目的文件夹打开 PowerShell，执行：

   ```powershell
   git clone https://github.com/nexus-personally/nexus.git
   cd nexus
   ```

   已经有项目的人直接打开项目根目录。执行 `Get-Item package.json`，确认终端位置正确。

2. 安装依赖并建立本机设置文件：

   ```powershell
   npm install
   Copy-Item .env.example .env
   ```

   如果 `.env` 已经存在，不要覆盖，直接编辑即可。`.env` 只供本机使用，**不要上传 GitHub**。

3. 用记事本打开设置：

   ```powershell
   notepad .env
   ```

   确认或加入以下内容；同名设置只留一行。**`DATABASE_URL` 必须有**，否则麻将帐号不会存进本机 PostgreSQL，而是存进本机 JSON 文件。Docker 方案用 `5432` 端口。

   ```env
   NODE_ENV=development
   API_PORT=3000
   PERSISTENCE=postgres
   DATABASE_URL=postgresql://nexus:nexus_dev_only@127.0.0.1:5432/nexus
   POSTGRES_SSL=false
   ```

   `nexus_dev_only` 只是本机示例密码，不能用作线上数据库密码。

4. 启动数据库并建立 NEXUS 的数据表：

   ```powershell
   npm run db:up
   npm run db:migrate
   ```

   第一次运行 Docker 可能要下载 PostgreSQL 映像，等它完成。麻将的 `mahjong_accounts` 和 `mahjong_sessions` 表由麻将服务启动时自动建立。

5. 构建网站并启动 API。**保持启动 API 的窗口开启**：

   ```powershell
   npm run build
   npm --workspace @nexus/api run dev
   ```

6. 用浏览器打开 [http://localhost:3000/](http://localhost:3000/)，点击 **System 02**；也可直接打开 [http://localhost:3000/mahjong/](http://localhost:3000/mahjong/)。在 [http://localhost:3000/api/health](http://localhost:3000/api/health) 看到 `"status":"ok"`，代表 API 已响应。

7. 下次开机只需在项目根目录运行 `npm run db:up` 和 `npm --workspace @nexus/api run dev`。修改了前端后，再运行 `npm run build` 并刷新浏览器。停止 API：在运行中的 PowerShell 按 **Ctrl+C**。停止数据库：`npm run db:down`。`db:down` 不会删除 Docker 数据卷；**不要执行 `docker compose down -v`**，那会删除数据库资料。

> `npm run dev` 是另一种开发方式：它另外开 Angular 开发网页 `http://localhost:4200/`，主要适合修改 Resume Studio。当前 Angular 开发代理只转发 `/api`，不会转发 `/mahjong/`。若要从 NEXUS 首页进入麻将，请按上面的流程打开 `localhost:3000`。

### 不使用 Docker：本机安装 PostgreSQL 18

本仓库另有 Windows 脚本，在 `5433` 端口建立本机 `nexus` 数据库。它与上面的 Docker 方案**二选一**。

1. 将 `.env` 的 `DATABASE_URL` 改为 `postgresql://nexus:nexus_dev_only@127.0.0.1:5433/nexus`。
2. 在项目根目录执行：

   ```powershell
   npm run db:local:up
   npm run db:migrate
   npm run build
   npm --workspace @nexus/api run dev
   ```

3. 浏览器仍打开 `http://localhost:3000/`。停用数据库用 `npm run db:local:down`。资料保存在 `work/postgres-data`，停止服务不会删除它。

## 第 3 步：查看本机数据库

先确认第 2 步的数据库和 API 已经启动。下面只用**读取命令**，不要执行 `DELETE`、`DROP`、`TRUNCATE`。

### Docker 方案：直接在 PowerShell 查看

在项目根目录打开**第二个** PowerShell 窗口，输入：

```powershell
docker compose -f docker-compose.local.yml exec postgres psql -U nexus -d nexus
```

看到 `nexus=#` 就已进入数据库。依次输入：

```sql
\dt
SELECT COUNT(*) FROM mahjong_accounts;
SELECT id, login, name FROM mahjong_accounts ORDER BY login;
SELECT COUNT(*) FROM mahjong_sessions;
\d mahjong_accounts
\q
```

`\dt` 列出数据表，`\d mahjong_accounts` 查看字段，`\q` 退出。`SELECT` 一定要有结尾分号。如果出现 `relation "mahjong_accounts" does not exist`，先启动本机 API，它启动时会建表。表存在却没有帐号时，确认浏览器使用的是 `localhost:3000/mahjong/`，并确认 `.env` 的 `DATABASE_URL` 指向本机 `5432`。

### 不用 Docker：使用 PostgreSQL 自带的 psql

在 PowerShell 输入以下命令；PostgreSQL 安装版本不是 18 时，将路径中的数字换成实际版本。此方案端口是 `5433`。

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5433 -U nexus -d nexus
```

进入 `nexus=#` 后，使用上方同一组 `\dt`、`SELECT`、`\q` 命令。

### PostgreSQL 没有帐号，但本机游戏已有帐号？

如果启动麻将时没有设 `DATABASE_URL`，帐号会保存在 `apps/mahjong/server/data/accounts.json`。可在本机用 `notepad apps/mahjong/server/data/accounts.json` 查看。文件含帐号资料与密码杂凑，**不要贴到聊天、截图或上传 GitHub**。后来才设置 `DATABASE_URL`，旧 JSON 帐号也不会自动搬到 PostgreSQL；新数据库需要重新注册或另做迁移。

## 第 4 步：更新 GitHub，并发布到现有 Render 网站

这是更新**已经存在**的 NEXUS，正常情况**不需要再创建** Web Service、Blueprint 或 Database。

1. 在项目根目录确认 Git 分支和远端：

   ```powershell
   git branch --show-current
   git remote -v
   git status
   ```

   当前项目的远端应为 `https://github.com/nexus-personally/nexus.git`。下面以 `main` 分支为例；如果你在其他分支，先确认如何合并到 `main`，不要直接推送。

2. 多人开发时先取回最新代码：`git pull origin main`。如果提示冲突或有未提交修改，先解决，不要继续推送。
3. 修改完成后运行 `npm run build`；再用 `git status` 看要上传哪些文件。**不要上传** `.env`、数据库网址或密码、`accounts.json`、`work/postgres-data`。
4. 例如只上传 README，可依次执行：

   ```powershell
   git add README.md
   git commit -m "docs: add local, Render and database guide"
   git push origin main
   ```

   改了其他文件时，把 `README.md` 换成明确要上传的路径。GitHub 要求登录时，使用对该仓库有写入权限的帐号。

5. 打开 [Render Dashboard](https://dashboard.render.com/) → 现有的 **nexus** Web Service → **Deploys**。若自动部署已开启，推送到关联的 `main` 后会自动构建；等状态显示 **Live**。如果没自动开始，用 **Manual Deploy → Deploy latest commit**。部署失败则打开该次部署的 **Logs** 看错误。
6. 打开[线上 NEXUS](https://nexus-2rwr.onrender.com/)，刷新后点 System 02；或打开[线上麻将](https://nexus-2rwr.onrender.com/mahjong/)。[健康检查](https://nexus-2rwr.onrender.com/api/health) 返回 `"status":"ok"` 表示 API 已回应。

**只有要在全新的 Render 帐号里部署另一个独立副本**，才按 [Render Blueprint 官方说明](https://render.com/docs/infrastructure-as-code) 选择 **New → Blueprint**，连接仓库并确认根目录的 `render.yaml` 与费用。现有服务不要重复这样做：Render 可能为重复的 Blueprint 新建另一组资源。

## 第 5 步：查看现在的线上 `nexus-db`

网页不能直接浏览 PostgreSQL 的表。先在 Render Dashboard 找连接资料，再在自己电脑用 `psql` 或 pgAdmin 打开。以下步骤只读，不会更改线上资料。

1. 登录 [Render Dashboard](https://dashboard.render.com/)，选 NEXUS 所在的 workspace。应该会看到 **nexus**（网站服务）和 **nexus-db**（PostgreSQL）。点击 **nexus-db**。
2. 在数据库页面右上角找 **Connect**。Render 的某些介面会在 **Info** 页显示连接资料。找 **External Database URL** 或 **PSQL Command**。你的电脑在 Render 网络外，必须用 **External**，不能用 **Internal**。连接文字含密码，**不能贴进 README、GitHub、截图或聊天**。
3. 如果已经安装 PostgreSQL，在 PowerShell 输入 `psql --version`；若找不到，可用完整路径，例如 `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" --version`。从 Render 复制 **PSQL Command**，只在**自己的 PowerShell** 粘贴执行。此命令包含线上凭证；不要放进公开终端录屏，也不要分享终端历史。外部连接必须启用 TLS；自行写连接网址时需要 `sslmode=require`。
4. 看到类似 `nexus=>` 的提示符后，依次执行：

   ```sql
   \dt
   SELECT COUNT(*) FROM mahjong_accounts;
   SELECT id, login, name FROM mahjong_accounts ORDER BY login;
   SELECT COUNT(*) FROM mahjong_sessions;
   \d mahjong_accounts
   \q
   ```

   `mahjong_accounts` 是麻将帐号，`mahjong_sessions` 是登录会话；不要查看或分享 `password`、`token_hash` 字段。Resume Studio 的资料在同一个数据库的其他表，如 `resumes`、`resume_versions`、`resume_publications`。先用 `\dt` 查看实际表名，再用 `\d 表名` 查看字段。
5. 连不上时：确认 `nexus-db` 显示 **Available**；复制的是 **External** 而非 Internal；电脑可上网；数据库页面的 **Access Control / IP allowlist** 允许你当前公网 IP。不要把生产数据库开放给所有 IP。Render 网站自身通过 `render.yaml` 的 `fromDatabase` 自动取得连接资料，不需把密码写进 Git。

Render 的最新介面与连接方法以[官方 PostgreSQL 说明](https://render.com/docs/postgresql-creating-connecting)为准。

### 不想用命令？用 pgAdmin 4 查看

PostgreSQL 安装包通常可选装 pgAdmin 4。打开它后：

1. 在左侧 **Servers** 右键 → **Register → Server**。
2. **General** 页 Name 填 `NEXUS 线上` 或 `NEXUS 本机`；这是电脑上的显示名称。
3. **Connection** 页填写 Host、Port、Database、Username、Password。线上值从 Render 的 **External Database URL** 读取；URL 大致长这样：`postgresql://用户名:密码@主机名:端口/数据库名`。本机 Docker 则填写 Host `127.0.0.1`、Port `5432`、Database `nexus`、Username `nexus`、Password `nexus_dev_only`；本机 PostgreSQL 脚本把 Port 改为 `5433`。
4. 线上连接把 **SSL mode** 设为 `require`；本机可设 `prefer` 或 `disable`。不希望 pgAdmin 保存线上密码，就取消 **Save password**。点击 **Save**。
5. 左侧依序展开 **Servers → 你的连接 → Databases → nexus → Schemas → public → Tables**。找到 `mahjong_accounts`，右键 → **View/Edit Data → First 100 Rows**。查看时不要编辑单元格，也不要使用 Delete / Drop。

## 常见问题

- **`localhost:3000` 打不开**：API 的 PowerShell 窗口是否还开着？窗口里是否有报错？端口 `3000` 是否被旧服务占用？
- **`localhost:4200` 的麻将进不去**：改用 `http://localhost:3000/`；这才是当前完整本机网站的入口。
- **数据库连接被拒绝**：确认 Docker Desktop / PostgreSQL 已运行。Docker 用 `5432`，本机 PostgreSQL 脚本用 `5433`，`.env`、`psql` 的端口必须一致。
- **本机与线上人数不一样**：这是两份独立数据库，属于正常情况。
- **在线上数据库找不到正在玩的房间**：房间和未完成牌局目前不写进 PostgreSQL。
- **Render 免费方案**：免费 Web Service 闲置后会休眠；Render 当前的免费 PostgreSQL 有容量限制，创建后 **30 天到期**，不适合长期保存重要资料。详情见 [Render 免费方案说明](https://render.com/docs/free)。
- **帐号安全**：麻将现在的「忘记密码」只凭登录名即可重设。公开邀请玩家前，应该增加真正的身份验证。

## 项目目录

- `apps/web`：NEXUS 首页、Resume Studio（Angular）。
- `apps/api`：NEXUS API 与统一网站服务（NestJS / Fastify）。
- `apps/mahjong`：System 02 麻将（React、Three.js、游戏引擎与房间服务）。
- `packages/shared`：Resume Studio 共用逻辑。
- `infra/migrations`：NEXUS 数据库迁移；麻将帐号表由麻将服务启动时建立。
- `render.yaml`：Render 网站服务和 PostgreSQL 的配置。
- `Dockerfile`：Render 使用的构建步骤。
