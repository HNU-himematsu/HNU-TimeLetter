/**
 * 核心数据类型定义
 * 供全项目使用
 */

// 故事实体 (对应飞书表格一行)
export interface Story {
  id: string;
  characterId: string;
  characterName: string;
  avatarUrl: string;      // Q版头像路径
  mainImageUrl: string;   // 高清大图路径
  content: string;        // 故事文本
  author: string;
  locationId: string;     // 关联的地点ID
  locationName?: string;
}

// 创作公示板 — 头表中每个 CardID 对应的地点与角色元数据
export interface CardHeaderInfo {
  cardId: string;
  location: string;
  character: string;
  sortOrder: number;
}

// 创作公示板实体 (对应揭示板表中的一行展示记录)
export interface CreationIdea {
  id: string;
  cardId: string;
  content: string;
  author: string;
  images: string[];
  createdAt: string;
  tags: string;
  sortOrder: number;
}

// 创作公示板 — 卡片内部的一条原始记录展示项
export interface CreationEntry {
  id: string;
  cardId: string;
  author: string;
  tags: string;        // 单个胶囊标签值
  content: string;
  images: string[];
  createdAt: string;
  sortOrder: number;
}

// 创作公示板 — 按 CardID 聚合后的卡片级渲染单元
export interface CreationCard {
  id: string;
  cardId: string;
  addIdeaUrl: string;
  entries: CreationEntry[];
  location?: string;
  character?: string;
}

// 地点实体 (前端聚合用)
export interface LocationPoint {
  id: string;
  name: string;
  x: number;              // 0-100% (SVG坐标百分比)
  y: number;              // 0-100%
  stories: Story[];       // 该地点包含的所有故事
}

// 鸣谢实体 (对应飞书参与贡献名单)
export interface Contributor {
  id: string;
  name: string;
  role?: string;
  message?: string;
}

// 飞书 API 响应类型 (用于同步脚本)
export interface FeishuRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

export interface FeishuResponse {
  code: number;
  msg: string;
  data: {
    items: FeishuRecord[];
    has_more: boolean;
    page_token?: string;
  };
}
