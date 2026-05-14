# 后台管理 API 文档

> 版本：v1.2
> Base URL：`/api/admin`
> 普通接口需通过 Cookie 鉴权；Webhook 接口使用 Bearer Token 鉴权

---

## 目录

- [鉴权说明](#1-鉴权说明)
- [登录接口](#2-登录接口)
- [同步配置接口](#3-同步配置接口)
- [同步任务接口](#4-同步任务接口)
- [公告配置接口](#5-公告配置接口管理后台)
- [同步兼容接口](#6-同步兼容接口)
- [前台数据接口](#7-前台数据接口)
- [前台公告接口](#8-前台公告接口)
- [Webhook 接口](#9-webhook-接口飞书自动化)
- [错误码一览](#10-错误码一览)
- [数据类型定义](#11-数据类型定义)

---

## 1. 鉴权说明

后台所有接口（`POST /api/admin/login` 除外）均要求携带有效的 `admin_auth` Cookie。

**Cookie 属性**

| 属性 | 值 |
|---|---|
| 名称 | `admin_auth` |
| HttpOnly | 是 |
| Secure | 是（生产环境） |
| SameSite | Lax |
| 有效期 | 7 天 |

**未鉴权响应**

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{ "message": "Unauthorized" }
```

**登录限流**

连续登录失败 5 次后触发 30 分钟冷却。冷却期内返回：

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 1800
Content-Type: application/json

{
  "success": false,
  "message": "Too many failed attempts",
  "retryAfterSeconds": 1800
}
```

---

## 2. 登录接口

### 2.1 POST /api/admin/login — 登录

**无需鉴权 Cookie**

**请求体**

```json
{
  "password": "your-password"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `password` | `string` | 是 | 管理员密码（环境变量 `ADMIN_PASSWORD`） |

**成功响应** `200 OK`

```json
{ "success": true }
```

同时在响应头中设置 `Set-Cookie: admin_auth=...`。

**密码错误** `401 Unauthorized`

```json
{ "success": false, "message": "Invalid password" }
```

**触发限流** `429 Too Many Requests`

```json
{
  "success": false,
  "message": "Too many failed attempts",
  "retryAfterSeconds": 1800
}
```

---

### 2.2 DELETE /api/admin/login — 登出

**需要鉴权 Cookie**

**请求体**：无

**响应** `200 OK`

```json
{ "success": true }
```

响应头清除 `admin_auth` Cookie（Max-Age=0）。

---

## 3. 同步配置接口

### 3.1 GET /api/admin/sync/config — 读取配置

**需要鉴权 Cookie**

**请求参数**：无

**成功响应** `200 OK`

```json
{
  "config": {
    "enabled": true,
    "cron": "0 2 * * *",
    "defaultTables": ["locations", "stories", "creation_headers", "creation_board", "contributors"]
  },
  "runtime": {
    "currentJobId": null,
    "lastJobId": "sync_20260430100000_ab12cd",
    "lastRunAt": "2026-04-30T10:00:00.000Z"
  },
  "availableTables": [
    {
      "key": "locations",
      "label": "地点表",
      "dependsOn": []
    },
    {
      "key": "stories",
      "label": "故事表",
      "dependsOn": []
    },
    {
      "key": "creation_headers",
      "label": "创作板-头表",
      "dependsOn": []
    },
    {
      "key": "creation_board",
      "label": "创作板-主表",
      "dependsOn": []
    },
    {
      "key": "contributors",
      "label": "参与贡献名单",
      "dependsOn": []
    }
  ],
  "nextRunAt": "2026-04-30T18:00:00.000Z"
}
```

**字段说明**

`config` 对象：

| 字段 | 类型 | 说明 |
|---|---|---|
| `enabled` | `boolean` | 定时任务是否启用 |
| `cron` | `string` | Cron 表达式 |
| `defaultTables` | `SyncTableKey[]` | 调度器默认同步的表 |

`runtime` 对象：

| 字段 | 类型 | 说明 |
|---|---|---|
| `currentJobId` | `string \| null` | 当前运行中的任务 ID |
| `lastJobId` | `string \| null` | 最近一次任务 ID |
| `lastRunAt` | `string \| null` | 上次同步完成时间（ISO 8601） |

顶层字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `availableTables` | `TableDefinition[]` | 系统支持的全部表 |
| `nextRunAt` | `string \| null` | 调度器下次执行时间（ISO 8601），未启用时为 `null` |

---

### 3.2 PATCH /api/admin/sync/config — 更新配置

**需要鉴权 Cookie**

配置更新后立即热更新调度器（不需要重启服务）。

**请求体**（所有字段均可选，只传需要修改的字段）

```json
{
  "enabled": true,
  "cron": "0 */6 * * *",
  "defaultTables": ["locations", "stories"]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `enabled` | `boolean` | 是否启用定时任务 |
| `cron` | `string` | Cron 表达式，至少 5 段 |
| `defaultTables` | `SyncTableKey[]` | 默认同步表，不可为空数组 |

**成功响应** `200 OK`

响应结构与 `GET /api/admin/sync/config` 相同（返回更新后的状态）。

**参数错误** `400 Bad Request`

```json
{ "message": "不支持的同步表: unknown_table" }
```

---

## 4. 同步任务接口

同步任务从飞书多维表格拉取数据，写入 `src/data/` 目录下的 JSON 产物文件。前端通过公开 API（`/api/content`、`/api/contributors`、`/api/creation-board`）在运行时读取这些文件，无需构建或重启服务。

### 4.1 GET /api/admin/sync/jobs — 任务列表

**需要鉴权 Cookie**

**查询参数**

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `limit` | `number` | `20` | 返回条数，最大 `100` |

**请求示例**

```
GET /api/admin/sync/jobs?limit=10
```

**成功响应** `200 OK`

```json
{
  "items": [
    {
      "jobId": "sync_20260430100000_ab12cd",
      "kind": "sync-data",
      "status": "success",
      "tables": ["locations", "stories"],
      "effectiveTables": ["locations", "stories"],
      "dependencyMode": "read_local",
      "includeAssets": true,
      "continueOnTableError": false,
      "triggeredBy": "admin-ui",
      "note": "手动刷新首页内容",
      "createdAt": "2026-04-30T10:00:00.000Z",
      "startedAt": "2026-04-30T10:00:00.200Z",
      "syncedAt": "2026-04-30T10:01:30.000Z",
      "finishedAt": "2026-04-30T10:01:30.000Z",
      "durationMs": 90000,
      "steps": [ /* SyncJobStep[] */ ],
      "summary": {
        "totalRecords": 11,
        "successRecords": 11,
        "skippedRecords": 0,
        "failedRecords": 0,
        "locationCount": 5,
        "storyCount": 6,
        "filesWritten": [
          "src/config/locations.json",
          "src/data/content.json"
        ]
      },
      "warnings": [],
      "errors": []
    }
  ]
}
```

返回结果按 `createdAt` 降序排列（最新任务在前）。

---

### 4.2 POST /api/admin/sync/jobs — 创建任务

**需要鉴权 Cookie**

任务创建后立即在后台异步执行，接口立即返回（不等待执行完成）。

**请求体**

```json
{
  "kind": "sync-data",
  "tables": ["locations", "stories"],
  "dependencyMode": "read_local",
  "includeAssets": true,
  "continueOnTableError": false,
  "triggeredBy": "admin-ui",
  "note": "手动刷新首页内容"
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `kind` | `SyncJobKind` | 否 | 来自配置 | 任务类型 |
| `tables` | `SyncTableKey[]` | 否 | 来自配置 | 本次同步的表，不可为空 |
| `dependencyMode` | `DependencyMode` | 否 | `"read_local"` | 依赖处理模式 |
| `includeAssets` | `boolean` | 否 | `true` | 是否处理附件并回写 OSS URL |
| `continueOnTableError` | `boolean` | 否 | `false` | 单表失败时是否继续执行剩余表 |
| `triggeredBy` | `string` | 否 | `"admin-ui"` | 触发来源标记 |
| `note` | `string` | 否 | — | 备注说明，显示在任务记录中 |

**成功响应** `202 Accepted`

```json
{
  "jobId": "sync_20260430100000_ab12cd",
  "status": "queued",
  "kind": "sync-data",
  "tables": ["locations", "stories"],
  "effectiveTables": ["locations", "stories"],
  "createdAt": "2026-04-30T10:00:00.000Z"
}
```

**任务冲突** `409 Conflict`（已有任务运行中）

```json
{
  "message": "已有同步任务正在执行",
  "currentJobId": "sync_20260430095900_xy99zz"
}
```

**参数错误** `400 Bad Request`

```json
{ "message": "不支持的同步表: unknown_table" }
```

---

### 4.3 GET /api/admin/sync/jobs/:jobId — 任务详情

**需要鉴权 Cookie**

**路径参数**

| 参数 | 说明 |
|---|---|
| `jobId` | 任务 ID，格式为 `sync_{YYYYMMDDHHmmss}_{随机6位}` |

**成功响应** `200 OK`

返回完整的 `SyncJobRecord` 对象：

```json
{
  "jobId": "sync_20260430100000_ab12cd",
  "kind": "sync-data",
  "status": "success",
  "tables": ["locations", "stories"],
  "effectiveTables": ["locations", "stories"],
  "dependencyMode": "read_local",
  "includeAssets": true,
  "continueOnTableError": false,
  "triggeredBy": "admin-ui",
  "note": "",
  "createdAt": "2026-04-30T10:00:00.000Z",
  "startedAt": "2026-04-30T10:00:00.200Z",
  "syncedAt": "2026-04-30T10:01:30.000Z",
  "finishedAt": "2026-04-30T10:01:30.000Z",
  "durationMs": 90000,
  "steps": [
    {
      "step": "locations",
      "status": "success",
      "startedAt": "2026-04-30T10:00:00.500Z",
      "finishedAt": "2026-04-30T10:00:45.000Z",
      "summary": {
        "totalRecords": 5,
        "successRecords": 5,
        "skippedRecords": 0,
        "failedRecords": 0,
        "filesWritten": ["src/config/locations.json"]
      },
      "warnings": [],
      "errors": []
    },
    {
      "step": "stories",
      "status": "success_with_warnings",
      "startedAt": "2026-04-30T10:00:45.000Z",
      "finishedAt": "2026-04-30T10:01:30.000Z",
      "summary": {
        "totalRecords": 7,
        "successRecords": 6,
        "skippedRecords": 0,
        "failedRecords": 1,
        "filesWritten": ["src/data/content.json"]
      },
      "warnings": ["记录 recXXX 缺少主图，已跳过图片处理"],
      "errors": []
    }
  ],
  "summary": {
    "totalRecords": 12,
    "successRecords": 11,
    "skippedRecords": 0,
    "failedRecords": 1,
    "locationCount": 5,
    "storyCount": 6,
    "filesWritten": [
      "src/config/locations.json",
      "src/data/content.json"
    ]
  },
  "warnings": ["记录 recXXX 缺少主图，已跳过图片处理"],
  "errors": []
}
```

> 任务步骤（`steps`）中的每一项对应一张同步表。同步完成写入 JSON 产物文件后，前端通过 `/api/content`、`/api/contributors`、`/api/creation-board` 等运行时 API 直接读取最新数据，无需构建或重启服务。

**任务不存在** `404 Not Found`

```json
{ "message": "Not found" }
```

---

### 4.4 GET /api/admin/sync/jobs/:jobId/logs — 任务日志

**需要鉴权 Cookie**

返回任务的详细执行日志（最后 200 行）。

**路径参数**

| 参数 | 说明 |
|---|---|
| `jobId` | 任务 ID |

**成功响应** `200 OK`（有日志文件）

```json
{
  "lines": [
    "[2026-04-30T10:00:00.500Z] [locations] 开始同步...",
    "[2026-04-30T10:00:01.000Z] [locations] 获取飞书 token 成功",
    "[2026-04-30T10:00:45.000Z] [locations] 完成，写入 src/config/locations.json"
  ],
  "total": 156
}
```

| 字段 | 说明 |
|---|---|
| `lines` | 日志行数组（最多 200 条，为日志文件末尾部分） |
| `total` | 日志文件总行数 |

**成功响应** `200 OK`（无日志文件）

```json
{ "lines": [], "total": 0 }
```

**任务不存在** `404 Not Found`

```json
{ "message": "Not found" }
```

---

## 5. 公告配置接口（管理后台）

### 5.1 GET /api/admin/announcement — 读取公告配置

**需要鉴权 Cookie**

**成功响应** `200 OK`

```json
{
  "docUrl": "https://himematsu.feishu.cn/docx/EbsDdehuLo1801xBzb1cxzJLnHb",
  "featureConfig": {
    "extensions": {}
  }
}
```

---

### 5.2 PATCH /api/admin/announcement — 更新公告配置

**需要鉴权 Cookie**

**请求体**

```json
{
  "docUrl": "https://himematsu.feishu.cn/docx/EbsDdehuLo1801xBzb1cxzJLnHb",
  "featureConfig": {
    "extensions": {}
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `docUrl` | `string` | 飞书文档链接（可选，不能为空串） |
| `featureConfig` | `object` | 功能配置（可选，必须为对象） |

**成功响应** `200 OK`：返回更新后的公告配置。

**参数错误** `400 Bad Request`

```json
{ "message": "文档链接不能为空" }
```

---

## 6. 同步兼容接口

### 6.1 GET /api/admin/sync — 读取同步状态

**需要鉴权 Cookie**

兼容旧版 API，返回同步状态与配置摘要。

**请求参数**：无

**成功响应** `200 OK`

```json
{
  "sync": {
    "enabled": true,
    "cron": "0 0 * * *",
    "lastRun": "2026-04-30T10:01:30.000Z",
    "status": "idle",
    "lastMessage": null
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `enabled` | `boolean` | 定时任务是否启用 |
| `cron` | `string` | Cron 表达式 |
| `lastRun` | `string \| null` | 上次同步完成时间 |
| `status` | `"idle" \| "running" \| "success" \| "failed"` | 当前同步状态 |
| `lastMessage` | `string \| null` | 上次执行的消息（错误信息或状态提示） |

---

### 6.2 POST /api/admin/sync — 同步操作

**需要鉴权 Cookie**

支持两种 action：触发同步任务（`trigger`）和更新调度配置（`update`）。

#### action = "trigger" — 触发同步

```json
{
  "action": "trigger",
  "tables": ["locations", "stories"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `action` | `"trigger"` | 是 | 操作类型 |
| `tables` | `string[]` | 否 | 要同步的表 key 列表 |

**成功响应** `200 OK`

```json
{ "message": "Sync triggered", "jobId": "sync_20260430100000_ab12cd" }
```

**任务冲突** `409 Conflict`

```json
{
  "message": "已有同步任务正在执行",
  "currentJobId": "sync_20260430095900_xy99zz"
}
```

#### action = "update" — 更新调度配置

```json
{
  "action": "update",
  "enabled": true,
  "cron": "0 */6 * * *"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `action` | `"update"` | 是 | 操作类型 |
| `enabled` | `boolean` | 否 | 是否启用定时任务 |
| `cron` | `string` | 否 | Cron 表达式 |

**成功响应** `200 OK`：返回与 `GET /api/admin/sync` 相同的状态对象。

**无效 action** `400 Bad Request`

```json
{ "message": "Invalid action" }
```

---

## 7. 前台数据接口

以下接口供前端页面读取数据，**无需鉴权**，直接从 `src/data/` 目录下的 JSON 产物文件读取。数据由飞书同步任务生成与更新。

### 7.1 GET /api/content — 读取地点与故事内容

**无需鉴权**

**请求参数**：无

**成功响应** `200 OK`

```json
{
  "locations": [
    {
      "id": "loc_001",
      "name": "图书馆",
      "x": 25,
      "y": 60,
      "stories": [
        {
          "id": "story_001",
          "characterId": "char_001",
          "characterName": "小明",
          "avatarUrl": "https://oss.example.com/avatars/xiaoming.png",
          "mainImageUrl": "https://oss.example.com/images/story_001.png",
          "content": "那天在图书馆，我第一次遇见了她……",
          "author": "Aki",
          "locationId": "loc_001",
          "locationName": "图书馆"
        }
      ]
    }
  ]
}
```

| 响应字段 | 类型 | 说明 |
|---|---|---|
| `locations` | `LocationPoint[]` | 地点列表，每个地点包含其下的故事 |
| `locations[].id` | `string` | 地点 ID |
| `locations[].name` | `string` | 地点名称 |
| `locations[].x` | `number` | X 坐标（0-100%，SVG 坐标系） |
| `locations[].y` | `number` | Y 坐标（0-100%，SVG 坐标系） |
| `locations[].stories` | `Story[]` | 该地点下的故事列表 |
| `stories[].id` | `string` | 故事 ID |
| `stories[].characterId` | `string` | 角色 ID |
| `stories[].characterName` | `string` | 角色名称 |
| `stories[].avatarUrl` | `string` | Q 版头像 URL |
| `stories[].mainImageUrl` | `string` | 高清大图 URL |
| `stories[].content` | `string` | 故事文本内容 |
| `stories[].author` | `string` | 作者 |
| `stories[].locationId` | `string` | 关联地点 ID |
| `stories[].locationName` | `string` | 关联地点名称（可选） |

**数据源**：`src/data/content.json`

---

### 7.2 GET /api/contributors — 读取鸣谢名单

**无需鉴权**

**请求参数**：无

**成功响应** `200 OK`

```json
{
  "contributors": [
    {
      "id": "contrib_001",
      "name": "张三",
      "role": "程序开发",
      "message": "感谢这个项目的每一位参与者"
    }
  ]
}
```

| 响应字段 | 类型 | 说明 |
|---|---|---|
| `contributors` | `Contributor[]` | 参与贡献名单 |
| `contributors[].id` | `string` | 贡献者 ID |
| `contributors[].name` | `string` | 贡献者名称 |
| `contributors[].role` | `string` | 角色/分工（可选） |
| `contributors[].message` | `string` | 留言（可选） |

**数据源**：`src/data/contributors.json`

---

### 7.3 GET /api/creation-board — 读取创作公示板

**无需鉴权**

**请求参数**：无

**成功响应** `200 OK`

```json
{
  "ideas": [
    {
      "id": "idea_001",
      "cardId": "card_01",
      "content": "在图书馆门口设计一个相遇场景",
      "author": "匿名",
      "images": ["https://oss.example.com/images/idea_001.png"],
      "createdAt": "2026-04-30T10:00:00.000Z",
      "tags": "场景设计",
      "sortOrder": 1
    }
  ],
  "headers": [
    {
      "cardId": "card_01",
      "location": "图书馆",
      "character": "小明",
      "sortOrder": 1
    }
  ]
}
```

| 响应字段 | 类型 | 说明 |
|---|---|---|
| `ideas` | `CreationIdea[]` | 创作公示板主表记录 |
| `ideas[].id` | `string` | 记录 ID |
| `ideas[].cardId` | `string` | 所属卡片 ID |
| `ideas[].content` | `string` | 内容 |
| `ideas[].author` | `string` | 作者 |
| `ideas[].images` | `string[]` | 图片 URL 列表 |
| `ideas[].createdAt` | `string` | 创建时间（ISO 8601） |
| `ideas[].tags` | `string` | 标签 |
| `ideas[].sortOrder` | `number` | 排序权重 |
| `headers` | `CardHeaderInfo[]` | 创作公示板头表（卡片元数据） |
| `headers[].cardId` | `string` | 卡片 ID |
| `headers[].location` | `string` | 地点名称 |
| `headers[].character` | `string` | 角色名称 |
| `headers[].sortOrder` | `number` | 排序权重 |

**数据源**：`src/data/creation-board.json` + `src/data/creation-board-headers.json`

---

## 8. 前台公告接口

### 8.1 GET /api/announcement-config — 读取前台公告配置

**无需鉴权**，前台弹窗打开时读取。

**成功响应** `200 OK`

```json
{
  "docUrl": "https://himematsu.feishu.cn/docx/EbsDdehuLo1801xBzb1cxzJLnHb",
  "featureConfig": {
    "extensions": {}
  }
}
```

---

### 8.2 GET /api/feishu-jsapi-signature — 生成飞书 JSAPI 签名

**无需 Cookie。** 查询参数：`url` 为当前页面完整 URL。

**成功响应** `200 OK`

```json
{
  "signature": "sha1-signature",
  "appId": "cli_xxx",
  "timestamp": 1778670000000,
  "nonceStr": "random",
  "url": "https://himematsu.cn/"
}
```

**参数错误** `400 Bad Request`

```json
{ "error": "Missing url parameter" }
```

**服务端错误** `500 Internal Server Error`

```json
{ "error": "缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET" }
```

---

## 9. Webhook 接口（飞书自动化）

### 9.1 POST /api/admin/sync/webhook — 飞书自动化触发同步

**不需要 Cookie，使用 Bearer Token 鉴权。**

专为飞书自动化设计：当飞书多维表格有新记录时，自动触发 `creation_board` 同步。任务异步执行，接口立即返回。同步完成后，前端通过运行时 API 直接读取最新数据，无需构建或重启。

**鉴权方式（任选其一）**

| 方式 | 示例 | 说明 |
|---|---|---|
| 请求头 | `Authorization: Bearer <SYNC_WEBHOOK_SECRET>` | 推荐，密锁不暗藏在 URL 中 |
| 查询参数 | `?secret=<SYNC_WEBHOOK_SECRET>` | 适用于不支持自定义 Header 的飞书自动化配置 |

**密锁来源**：环境变量 `SYNC_WEBHOOK_SECRET`（优先），未设置时回退使用 `ADMIN_PASSWORD`。

> 建议单独设置 `SYNC_WEBHOOK_SECRET`，避免将管理员密码暗藏在 URL 日志中。

**请求体**：可为空，也可以是飞书自动化传递的任意 JSON（服务端不使用请求体内容）。

**查询参数**

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `tables` | `string` | `creation_board` | 逗号分隔的同步表 key，例如 `creation_board,creation_headers` |

**成功响应** `202 Accepted`

```json
{
  "jobId": "sync_20260430100000_ab12cd",
  "status": "queued",
  "message": "同步任务已创建"
}
```

**参数错误** `400 Bad Request`

```json
{ "message": "不支持的同步表: unknown_table" }
```

**鉴权失败** `401 Unauthorized`

```json
{ "message": "Unauthorized" }
```

**任务冲突** `409 Conflict`（已有任务运行中）

```json
{
  "message": "已有同步任务运行中，请等待完成后重试",
  "currentJobId": "sync_20260430095900_xy99zz"
}
```

**限流** `429 Too Many Requests`（每个 IP 每小时最多 60 次）

```json
{ "message": "请求过于频繁，请稍后重试" }
```

**飞书自动化配置示例**

在飞书自动化中，选择「发送 HTTP 请求」动作。

#### 配置一：仅同步创作板主表

| 配置项 | 内容 |
|---|---|
| 请求方法 | `POST` |
| URL | `https://himematsu.cn/api/admin/sync/webhook` |
| 请求头 | `Authorization: Bearer <SYNC_WEBHOOK_SECRET>` |
| 请求体 | 空即可 |

#### 配置二：同步创作板主表 + 头表

| 配置项 | 内容 |
|---|---|
| 请求方法 | `POST` |
| URL | `https://himematsu.cn/api/admin/sync/webhook?tables=creation_board,creation_headers` |
| 请求头 | `Authorization: Bearer <SYNC_WEBHOOK_SECRET>` |
| 请求体 | 空即可 |

> 使用查询参数鉴权方式时，将 `secret` 参数追加到 URL 末尾即可，例如：
> ```
> https://himematsu.cn/api/admin/sync/webhook?secret=<SYNC_WEBHOOK_SECRET>&tables=creation_board,creation_headers
> ```

---

## 10. 错误码一览

| 状态码 | 含义 | 场景 |
|---|---|---|
| `200` | 成功 | 查询、更新、登出 |
| `202` | 已接受（异步处理） | 创建任务 |
| `400` | 请求参数错误 | 表 key 无效、Cron 格式错误等 |
| `401` | 未鉴权 / 密码错误 | 未登录或密码错误 |
| `404` | 资源不存在 | 任务 ID 不存在 |
| `409` | 冲突 | 已有任务运行中 |
| `429` | 请求过于频繁 | 登录失败次数超限 |
| `500` | 服务器内部错误 | 文件读写失败等 |

---

## 11. 数据类型定义

### SyncJobKind

```ts
type SyncJobKind = 'sync-data';
```

| 值 | 说明 |
|---|---|
| `sync-data` | 从飞书多维表格同步数据到 `src/data/` 目录下的 JSON 产物文件 |

### SyncTableKey

```ts
type SyncTableKey = keyof SyncTableOutputMap;
```

| 值 | 飞书表 | 输出文件 |
|---|---|---|
| `locations` | 地点表 | `src/config/locations.json` |
| `stories` | 故事表 | `src/data/content.json` |
| `creation_headers` | 创作板-头表 | `src/data/creation-board-headers.json` |
| `creation_board` | 创作板-主表 | `src/data/creation-board.json` |
| `contributors` | 参与贡献名单 | `src/data/contributors.json` |

### DependencyMode

```ts
type DependencyMode = 'read_local' | 'run_dependencies' | 'strict';
```

| 值 | 说明 |
|---|---|
| `read_local` | 只同步所选表，依赖表从本地产物读取（**默认**） |
| `run_dependencies` | 自动补跑依赖表 |
| `strict` | 依赖缺失即失败，不自动读取也不自动补跑 |

### SyncJobStatus

```ts
type SyncJobStatus = 'queued' | 'running' | 'success' | 'partial_success' | 'failed' | 'canceled';
```

| 值 | 说明 |
|---|---|
| `queued` | 已创建，等待执行 |
| `running` | 执行中 |
| `success` | 全部成功 |
| `partial_success` | 有部分失败，但产物已生成 |
| `failed` | 执行失败，产物未更新 |
| `canceled` | 已取消 |

### SyncStepStatus

```ts
type SyncStepStatus = 'pending' | 'running' | 'success' | 'success_with_warnings' | 'skipped' | 'failed';
```

| 值 | 说明 |
|---|---|
| `pending` | 等待执行 |
| `running` | 执行中 |
| `success` | 成功 |
| `success_with_warnings` | 成功但有部分记录异常 |
| `skipped` | 因依赖缺失或被终止而跳过 |
| `failed` | 失败 |

### 数据流说明

```
飞书多维表格（数据源）
    ↓ 同步任务（定时/手动/Webhook）
src/data/*.json（产物文件）
    ↓ 运行时 API（/api/content, /api/contributors, /api/creation-board）
前端页面
```

同步完成后 JSON 产物文件即更新，前端通过运行时 API 读取最新数据，不需要构建或重启服务。
