# 后台管理 API 文档

> 版本：v1.0
> Base URL：`/api/admin`
> 所有接口（登录除外）需通过 Cookie 鉴权

---

## 目录

- [鉴权说明](#1-鉴权说明)
- [登录接口](#2-登录接口)
- [同步配置接口](#3-同步配置接口)
- [同步任务接口](#4-同步任务接口)
- [错误码一览](#5-错误码一览)
- [数据类型定义](#6-数据类型定义)

---

## 1. 鉴权说明

后台所有接口（`POST /api/admin/login` 除外）均要求携带有效的 `admin_session` Cookie。

**Cookie 属性**

| 属性 | 值 |
|---|---|
| 名称 | `admin_session` |
| HttpOnly | 是 |
| Secure | 是（生产环境） |
| SameSite | Strict |
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

同时在响应头中设置 `Set-Cookie: admin_session=...`。

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

响应头清除 `admin_session` Cookie（Max-Age=0）。

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
    "defaultTables": ["locations", "stories", "creation_board", "contributors"],
    "defaultJobKind": "sync-data",
    "dataPublishMode": "build_time"
  },
  "runtime": {
    "currentJobId": null,
    "lastJobId": "sync-1746028800000-ab12",
    "lastRunAt": "2026-04-30T10:00:00.000Z",
    "lastPublishAt": "2026-04-30T10:10:00.000Z",
    "hasPendingPublish": false
  },
  "availableTables": [
    {
      "key": "locations",
      "label": "地点",
      "dependsOn": []
    },
    {
      "key": "stories",
      "label": "故事",
      "dependsOn": ["locations"]
    },
    {
      "key": "creation_board",
      "label": "创作公示板",
      "dependsOn": []
    },
    {
      "key": "contributors",
      "label": "鸣谢名单",
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
| `defaultJobKind` | `SyncJobKind` | 调度器默认任务类型 |
| `dataPublishMode` | `"build_time"` | 数据发布模式（固定值） |

`runtime` 对象：

| 字段 | 类型 | 说明 |
|---|---|---|
| `currentJobId` | `string \| null` | 当前运行中的任务 ID |
| `lastJobId` | `string \| null` | 最近一次任务 ID |
| `lastRunAt` | `string \| null` | 上次同步完成时间（ISO 8601） |
| `lastPublishAt` | `string \| null` | 上次发布完成时间（ISO 8601） |
| `hasPendingPublish` | `boolean` | 是否存在已同步但未发布的数据 |

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
  "defaultTables": ["locations", "stories"],
  "defaultJobKind": "sync-data"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `enabled` | `boolean` | 是否启用定时任务 |
| `cron` | `string` | Cron 表达式，至少 5 段 |
| `defaultTables` | `SyncTableKey[]` | 默认同步表，不可为空数组 |
| `defaultJobKind` | `SyncJobKind` | 默认任务类型 |

**成功响应** `200 OK`

响应结构与 `GET /api/admin/sync/config` 相同（返回更新后的状态）。

**参数错误** `400 Bad Request`

```json
{ "message": "Invalid cron expression" }
```

---

## 4. 同步任务接口

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
      "jobId": "sync-1746028800000-ab12",
      "kind": "sync-data",
      "status": "success",
      "publishStatus": null,
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
  "jobId": "sync-1746028800000-ab12",
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
  "message": "A sync job is already running",
  "currentJobId": "sync-1746028700000-xy99"
}
```

**参数错误** `400 Bad Request`

```json
{ "message": "Invalid table key: unknown_table" }
```

---

### 4.3 GET /api/admin/sync/jobs/:jobId — 任务详情

**需要鉴权 Cookie**

**路径参数**

| 参数 | 说明 |
|---|---|
| `jobId` | 任务 ID，格式为 `sync-{timestamp}-{随机4位}` |

**成功响应** `200 OK`

返回完整的 `SyncJobRecord` 对象：

```json
{
  "jobId": "sync-1746028800000-ab12",
  "kind": "sync-data-and-publish",
  "status": "success",
  "publishStatus": "published",
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
  "publishedAt": "2026-04-30T10:04:00.000Z",
  "finishedAt": "2026-04-30T10:04:00.000Z",
  "durationMs": 240000,
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
    },
    {
      "step": "publish",
      "status": "success",
      "startedAt": "2026-04-30T10:01:30.000Z",
      "finishedAt": "2026-04-30T10:04:00.000Z",
      "summary": {},
      "warnings": [],
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
    ],
    "published": true
  },
  "warnings": ["记录 recXXX 缺少主图，已跳过图片处理"],
  "errors": []
}
```

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

## 5. 错误码一览

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

## 6. 数据类型定义

### SyncJobKind

```ts
type SyncJobKind = 'sync-data' | 'sync-data-and-publish';
```

| 值 | 说明 |
|---|---|
| `sync-data` | 仅同步数据到产物文件，不执行构建/重启 |
| `sync-data-and-publish` | 同步数据后继续执行构建与重启 |

### SyncTableKey

```ts
type SyncTableKey = 'locations' | 'stories' | 'creation_board' | 'contributors';
```

| 值 | 飞书表 | 输出文件 |
|---|---|---|
| `locations` | 地点表 | `src/config/locations.json` |
| `stories` | 故事表 | `src/data/content.json` |
| `creation_board` | 创作公示板 | `src/data/creation-board.json` |
| `contributors` | 鸣谢名单 | `src/data/contributors.json` |

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

### SyncPublishStatus

```ts
type SyncPublishStatus = 'not_required' | 'building' | 'published' | 'publish_failed';
```

| 值 | 说明 |
|---|---|
| `not_required` | 任务类型为 `sync-data`，无需发布 |
| `building` | 发布阶段执行中（build + restart） |
| `published` | 发布成功，线上页面已更新 |
| `publish_failed` | 构建或重启失败，线上页面仍使用旧数据 |

### SyncJobStepStatus

```ts
type SyncJobStepStatus = 'pending' | 'running' | 'success' | 'success_with_warnings' | 'skipped' | 'failed';
```

| 值 | 说明 |
|---|---|
| `pending` | 等待执行 |
| `running` | 执行中 |
| `success` | 成功 |
| `success_with_warnings` | 成功但有部分记录异常 |
| `skipped` | 因依赖缺失被跳过 |
| `failed` | 失败，无法生成产物 |
