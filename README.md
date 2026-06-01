# 《心事侦探社》第一轮专家咨询云端表单

这是一个可部署到 Render、数据存储到 Neon PostgreSQL 的专家咨询表项目。表单内容依据《心事侦探社：在故事里寻找情绪与需要》第一轮专家咨询表整理，评分项全部改为 1—5 分拖条式评分。

## 功能

- 专家基本信息填写
- 游戏机制评审
- 情绪词库评审
- 需求词库评审
- 整体评价与开放性意见
- “是否建议进入下一步”单选题
- 评分拖条显示最低分和最高分含义：
  - 1 分：很不合适
  - 5 分：非常合适
- 提交后写入 Neon PostgreSQL 的 `delphi_responses` 表
- 管理端接口：
  - JSON：`/api/responses?token=你的ADMIN_TOKEN`
  - CSV：`/api/responses.csv?token=你的ADMIN_TOKEN`

## 本地运行

```bash
npm install
cp .env.example .env
# 修改 .env 中的 DATABASE_URL 和 ADMIN_TOKEN
npm run dev
```

打开：`http://localhost:10000`

## Neon 设置

1. 在 Neon 新建一个 Project。
2. 复制 PostgreSQL 连接字符串，建议使用 Neon 文档推荐的安全连接模式，例如：

```text
postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=verify-full
```

3. 把连接字符串填入 Render 的 `DATABASE_URL` 环境变量。
4. 应用启动时会自动创建数据表；也可以手动执行 `db/schema.sql`。

## Render 部署

### 方式一：通过 GitHub + Render Web Service

1. 把本项目上传到 GitHub。
2. Render 新建 Web Service，连接该 GitHub 仓库。
3. 环境选择 Node。
4. Build Command：

```bash
npm install
```

5. Start Command：

```bash
npm start
```

6. 添加环境变量：

```text
DATABASE_URL=你的 Neon PostgreSQL 连接字符串
ADMIN_TOKEN=自行设置的导出密钥
NODE_ENV=production
```

7. 部署成功后，Render 会提供一个 `onrender.com` 域名。

### 方式二：Blueprint

项目内包含 `render.yaml`，可以在 Render 中使用 Blueprint 创建服务。`DATABASE_URL` 需要在 Render 控制台中手动填写。

## 数据表结构

```sql
CREATE TABLE IF NOT EXISTS delphi_responses (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expert_name TEXT,
  expert_org TEXT,
  payload JSONB NOT NULL
);
```

`payload` 保存完整表单 JSON，方便后续做 Delphi 专家咨询统计、均值、标准差、满分比、变异系数等分析。
