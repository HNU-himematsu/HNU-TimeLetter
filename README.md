# 与她的海大时光笺 (HNU-TimeLetter)

> 基于海南大学校园地图的 Galgame 风格交互式视觉叙事网站

## 项目简介

将 Galgame 风格的二次元角色与海南大学校园实景结合，以「图 + 文 + 开信仪式」的形式呈现校园内的决定性瞬间与背后的故事。站点由四条路由构成：

| 路由 | 说明 |
|---|---|
| `/` | 启封主屏（信封开信仪式）+ 关于企划 / 关于我们 / 鸣谢 / 页脚下滚页面群 |
| `/map` | 地图主体验——桌面端交互式地图 + 故事卡片，移动端掌心集邮册瀑布流 |
| `/creation` | 群友共创灵感公示板，便签瀑布流 |
| `/admin` | 后台管理——手动同步飞书数据、定时任务配置 |

## 视觉基调

- **背景色**: `#ece9e4` 暖灰纸面
- **主强调色**: `#c23643` 火漆红
- **标题字体**: `ChillDINGothic_SemiBold`（本地 OTF）
- **正文字体**: `ZouLDFXKAJ`（本地 TTF）
- **设计意象**: 被翻开的纪念册 + 收到的私人来信；5px 白边 + 16px 圆角全站视口画框

## 技术栈

| 层次 | 技术 |
|---|---|
| 框架 | Next.js 16.2.4（App Router，Turbopack） |
| 语言 | TypeScript 5+（Strict Mode） |
| 样式 | Tailwind CSS v4 + Radix UI / Shadcn 风格组件 |
| 动画 | Framer Motion v12 |
| 平滑滚动 | Lenis（桌面端启封态下滚页面群） |
| 状态管理 | Zustand v5 |
| CMS | 飞书多维表格（Feishu Bitable） |
| 对象存储 | 阿里云 OSS |
| 定时任务 | node-schedule（`/admin` 自动同步） |
| 测试 | Playwright（E2E） |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

Node.js 版本要求 ≥ 20。

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填写凭证：

```bash
cp .env.example .env.local   # Linux / macOS
copy .env.example .env.local  # Windows
```

关键变量（详见 [docs/guides/飞书CMS配置.md](./docs/guides/飞书CMS配置.md)）：

- **飞书基础**：`FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_APP_TOKEN` / `FEISHU_TABLE_ID` / `FEISHU_VIEW_ID`
- **创作公示板**：`FEISHU_CREATION_TABLE_ID` / `FEISHU_CREATION_VIEW_ID`
- **阿里云 OSS**：`ALIYUN_OSS_REGION` / `ALIYUN_OSS_BUCKET` / `ALIYUN_OSS_ACCESS_KEY_ID` / `ALIYUN_OSS_ACCESS_KEY_SECRET`
- **后台鉴权**：`ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET`（生产环境的 `ADMIN_SESSION_SECRET` 长度不少于 32 字节）

### 3. 同步数据

从飞书拉取最新内容：

```bash
npm run sync
```

产物写入 `src/data/content.json`（首页故事）、`src/data/creation-board.json`（创作公示板）与 `src/data/contributors.json`（鸣谢名单）。前台通过内容 API 读取运行时 JSON，客户端定时刷新数据。

### 4. 启动开发服务器

```bash
npm run dev
```

- 首页：[http://localhost:3000](http://localhost:3000)
- 地图主体验：[http://localhost:3000/map](http://localhost:3000/map)
- 创作公示板：[http://localhost:3000/creation](http://localhost:3000/creation)
- 后台管理：[http://localhost:3000/admin](http://localhost:3000/admin)

## 项目结构

```
src/
├── app/
│   ├── admin/              # /admin 后台（登录 + 受保护分组）
│   ├── api/admin/          # 后台 API（登录、手动同步）
│   ├── creation/           # /creation 创作公示板路由
│   ├── map/                # /map 地图主体验路由
│   ├── layout.tsx          # 全局布局 + 本地字体注册 + 全站视口画框
│   ├── page.tsx            # 首页（启封主屏 + 下滚页面群）
│   ├── loading.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/                 # Shadcn 风格基础组件
│   ├── shared/             # EnvelopeIntro / GuideLine / CustomScrollbar
│   │                       # GlobalNav / TransitionOverlay
│   ├── sections/           # AboutProject / AboutUs / Credits / Footer / ScrollSections
│   ├── desktop/            # PC 端组件（Dev B）
│   ├── mobile/             # 移动端组件（Dev C）
│   └── creation/           # 创作公示板便签瀑布流
├── lib/
│   ├── admin/              # 后台鉴权 / 调度器 / 配置读写
│   ├── sync-service.ts     # 飞书 + OSS 同步主服务（CLI 与 API 复用）
│   ├── types.ts            # 核心领域类型（SSOT）
│   ├── store.ts            # Zustand 全局状态
│   ├── hooks.ts
│   ├── useVirtualScroll.ts # Lenis 封装
│   └── content.ts / utils.ts
├── config/                 # admin.json、locations.json 等本地配置
├── data/                   # 同步产物：content.json / creation-board.json
└── scripts/                # sync-feishu.ts + 飞书 / OSS 调试脚本
```

根目录另有 `public/` 静态资源（含本地字体）、`tests/e2e/` Playwright 用例，以及 `agents/` / `.opencode/agents/` / `.trae/skills/` 协作资产目录（不纳入 `src/` 编译边界）。

## 数据模型速览

核心领域类型以 [src/lib/types.ts](./src/lib/types.ts) 为准：

- `Story`：首页展陈故事记录。
- `LocationPoint`：地图 Pin 聚合结构。
- `CreationIdea` / `CreationEntry` / `CreationCard`：创作公示板的原始记录、页面堆叠条目与卡片聚合。

完整字段、来源映射与聚合规则见 [docs/architecture/数据模型.md](./docs/architecture/数据模型.md)。

## 部署

项目包含两类运行模型：

| 环境 | 用途 | 数据模型 |
|---|---|---|
| Vercel Preview | 分支预览与视觉效果验收 | 使用仓库内 `src/data/*.json` 作为构建时兜底数据，内容 API 以 `no-store` 响应返回当前运行时文件 |
| 自托管生产环境 | 正式发布与后台同步 | GitHub Actions 在 `release` 分支执行质量门禁、同步飞书、构建产物、上传 OSS，并由服务器拉取部署；后台同步写入 `src/data/*.json` 后通过内容 API 热更新前台数据 |

常用验证命令：

```bash
npm run lint
npm run typecheck
npm run test:e2e
npm audit --omit=dev
npm run build
```

生产环境须下发 `ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`、飞书与 OSS 凭证。`ADMIN_SESSION_SECRET` 使用独立随机值，长度不少于 32 字节。

## 文档索引

文档入口：[docs/文档索引.md](./docs/文档索引.md)

- 架构：[技术栈](./docs/architecture/技术栈.md) · [数据模型](./docs/architecture/数据模型.md)
- 指南：[环境搭建](./docs/guides/环境搭建.md) · [飞书 CMS 配置](./docs/guides/飞书CMS配置.md)
- 设计：[交互设计](./docs/design/交互设计.md) · [视觉规范](./docs/design/视觉规范.md) · [创作公示板](./docs/design/创作公示板.md) · [全站视口画框](./docs/design/全站视口画框.md) · [开屏页重构](./docs/design/开屏页重构.md) · [后台管理系统](./docs/design/后台管理系统.md)
- 进度与评审：[项目进度](./docs/项目进度.md) · [评审报告目录](./docs/review/)

## License

本项目以 [MIT License](./LICENSE) 授权发布。
