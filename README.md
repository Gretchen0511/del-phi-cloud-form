# 心事侦探社两轮专家咨询同时保留版

这个包在同一个 Render 服务和同一个 Neon 数据库中同时提供两轮问卷。第一轮保留现有问卷、管理页面、提交接口和导出地址；第二轮使用独立页面、接口和数据表。无需新建 Render 服务或 Neon 项目。

## 更新现有 GitHub

1. 解压本次的 `delphi-both-rounds-render-neon.zip`，打开 `delphi-both-rounds` 文件夹。
2. 在 `Gretchen0511/del-phi-cloud-form` 仓库首页，点绿色 **Code** 按钮左侧的小 **＋**，选择 **Upload files**（有些界面显示为 **Add file → Upload files**）。
3. 把解压文件夹**里面**的全部文件和子文件夹拖进去，覆盖同名代码文件，再 **Commit changes**。保持 `public` 和 `db` 等文件夹结构。上传后仓库首页应直接看到 `server.js`、`legacy.js`、`lib.js`、`package.json` 和 `package-lock.json`；第二轮文件位于 `public/round2`。不要把ZIP或外层目录上传为项目子目录。
4. 回到原 Render 服务，检查 **Settings**：Build Command 为 `npm ci --omit=dev`；Start Command 为 `npm start`；Health Check Path 为 `/healthz`（旧的 `/health` 也继续有效）。Root Directory 仍指向仓库根目录；原来留空则保持留空。
5. 在 **Environment** 继续使用原有 `DATABASE_URL` 和 `ADMIN_TOKEN`，确认 `NODE_VERSION` 为 `22.16.0`。连接串仍指向保存第一轮答案的那个 Neon 数据库，保留其中的SSL参数。不要把密码或数据库连接串上传至GitHub。
6. 点 **Manual Deploy → Deploy latest commit**。如果已经自动部署同一最新提交，可直接查看部署结果。显示 **Live** 后按下表核验两轮入口。

本次使用这个“两轮同时保留版”更新。之前的单独第二轮包不适用于本次“两轮同时保留”的要求。

## 部署后的入口

| 用途 | 地址 |
| --- | --- |
| 第一轮问卷，原链接继续有效 | https://del-phi-cloud-form.onrender.com/ |
| 第一轮问卷别名 | https://del-phi-cloud-form.onrender.com/round1 |
| 第一轮管理与CSV导出 | https://del-phi-cloud-form.onrender.com/admin |
| 第二轮问卷 | https://del-phi-cloud-form.onrender.com/round2 |
| 第二轮管理与CSV导出 | https://del-phi-cloud-form.onrender.com/admin/round2 |
| 两轮入口总览 | https://del-phi-cloud-form.onrender.com/rounds |

两轮后台使用原来的同一个管理员密码。邀请第二轮专家时发送 `/round2` 链接。

## 第一轮保留范围

第一轮来源为现有公开GitHub仓库 `Gretchen0511/del-phi-cloud-form` 的 `main` 分支，2026年10月19日读取。

- `public/index.html`、`public/admin.html`、`public/app.js`、`public/style.css` 与读取到的第一轮原文件逐字相同。
- 原问卷的指导语、题目、评分交互和提交格式保留。第一轮原有默认3分行为也保持原样；第二轮采用主动评分。
- `/api/submit`、`POST /api/responses` 继续写入第一轮的 `delphi_responses` 表。
- `GET /api/responses` 返回原格式 `{ok,count,rows}`；`/api/responses.csv` 保留原有展开评分列。
- 第一轮管理接口继续兼容原来的 `?token=` 方式和 Bearer 请求头；旧管理页继续可用。
- 第一轮页面原本含有内联脚本与样式，服务器只对这两个保留页面设置对应内容安全策略。第二轮页面继续只加载同源独立脚本和样式。

后端合并为一个服务，并为旧CSV补充日期规范化与公式文本转义。既有数据库记录不会被重写。

## 两轮数据如何分开

第一轮表：`delphi_responses`，保持原有列结构。

第二轮表：`delphi_round2_responses`，独立保存UUID、专家编号、时间、版本和完整JSONB答案。

启动时只对两张表运行 `CREATE TABLE IF NOT EXISTS`。没有删除、清空、覆盖或迁移已有答案的操作。两轮提交、管理员查询和导出各自只访问对应的表；同一专家可以分别填写两轮。

无需在Neon中创建新数据库或修改第一轮表。若数据库账号没有建表权限，在同一数据库的Neon SQL Editor运行 `db/round2.sql` 即可。不要运行任何清空数据库的脚本。

## 第二轮内容与作答

完整保留原Word中面向专家的说明、前轮反馈与修订对照、A–G评价、词盘与玩法说明；两处标记为研究内部的说明整段排除。原文封面月份“2026年7月”照录。

44项A–G评分，加三种玩法×五维度的15项评分，共59项，初始均“未评分”。需要主动点击数字或操作拖条，3分也需主动确认，后端只接受1–5整数。

9项词语处置、3项计分处置、4项材料必要性、阅读确认、材料查看多选、应用场景多选和最终决定均保留。专家编号、填写日期和所有评分及选择题必填；多选至少选一项。“其他”应用场景选中后须写明。所有修改建议、A7及最终开放意见选填。

第二轮管理页逐题显示评分与文字。CSV按问卷顺序展开独立列，带中文表头、UTF-8 BOM，支持Excel/WPS；多选以中文分号分隔，不会出现 `[object Object]`。

第二轮答案仅保留在当前页面内存；提交失败可原页重试，固定提交UUID可防止网络重试重复入库。刷新或关闭会丢失未提交答案。独立送审规则书、简释书和卡牌等材料未随本次附件提供，仍由研究组另行发送。

## 上线核验

部署后打开原第一轮问卷，确认仍显示“第一轮专家咨询”；进入 `/admin` 确认原有记录可查看和下载CSV。再打开 `/round2`，确认显示第二轮、评分初始未作答；进入 `/admin/round2` 确认只显示第二轮记录。

若进行实际测试提交，请使用明确的测试专家编号并记录回执。当前无删除记录功能，测试提交会保留在对应表中，分析时需排除。

## 本地开发

需要Node.js 22及以上。安装并配置环境变量：

```sh
npm ci
export DATABASE_URL='你的Neon连接串'
export ADMIN_TOKEN='你的管理员密码'
npm start
```

默认本地端口10000，部署时读取Render提供的PORT。`.env.example`仅作格式参考，程序不自动读取`.env`。测试使用内存PostgreSQL兼容数据库，不连接生产Neon：

```sh
npm test
```

接口：

- 第一轮提交：`POST /api/submit` 或 `POST /api/responses`
- 第一轮读取与导出：`GET /api/responses`、`GET /api/responses.csv`
- 第二轮提交：`POST /api/round2/responses`
- 第二轮读取与导出：`GET /api/round2/admin/responses`、`GET /api/round2/admin/export.csv`
- 第二轮字段定义：`public/round2/schema.json`
- 健康检查：`GET /healthz`、`GET /health`

第二轮管理接口只接受 `Authorization: Bearer <ADMIN_TOKEN>`，其新管理页已自动处理。生产数据库尚未连接，线上部署尚未执行；测试范围见 `测试说明.md`。
