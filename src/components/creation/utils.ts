import type { CardHeaderInfo, CreationIdea, CreationCard, CreationEntry } from '@/lib/types';

const ADD_IDEA_URL_TEMPLATE =
  'https://himematsu.feishu.cn/share/base/form/shrcnhSnlbEAclIwPC770VdOmWf?hide_CardID=1&prefill_CardID=';

/**
 * 将原始 CreationIdea[] 按 CardID 聚合为页面消费的 CreationCard[]
 * 可选传入头表数据，自动将地点/角色合并到对应卡片
 */
export function groupIdeasToCards(
  ideas: CreationIdea[],
  headers: CardHeaderInfo[] = [],
): CreationCard[] {
  const cardMap = new Map<string, CreationEntry[]>();

  for (const idea of ideas) {
    const entry: CreationEntry = {
      id: idea.id,
      cardId: idea.cardId,
      author: idea.author,
      tags: idea.tags,
      content: idea.content,
      images: idea.images,
      createdAt: idea.createdAt,
    };

    if (!cardMap.has(idea.cardId)) {
      cardMap.set(idea.cardId, []);
    }
    cardMap.get(idea.cardId)!.push(entry);
  }

  const headerMap = new Map<string, CardHeaderInfo>(headers.map(h => [h.cardId, h]));

  const cards: CreationCard[] = [];
  for (const [cardId, entries] of cardMap) {
    const hdr = headerMap.get(cardId);
    cards.push({
      id: cardId,
      cardId,
      addIdeaUrl: `${ADD_IDEA_URL_TEMPLATE}${encodeURIComponent(cardId)}`,
      entries,
      location: hdr?.location || undefined,
      character: hdr?.character || undefined,
    });
  }

  return cards;
}

/**
 * 马卡龙色板 — 低饱和、柔和、可读
 * 每张卡片一个底色基调
 */
const MACARON_COLORS = [
  '#fce4e4', // 浅粉
  '#fef0d5', // 浅杏
  '#e4f0d0', // 浅绿
  '#d5eef7', // 浅蓝
  '#ece0f5', // 浅紫
  '#fde8d0', // 浅橘
  '#d5f0e8', // 浅青
  '#f5e0e8', // 浅玫瑰
  '#e8ecd5', // 浅黄绿
  '#e0e8f5', // 浅天蓝
];

/**
 * 根据 cardId 确定性地选取马卡龙底色
 */
export function getCardColor(cardId: string): string {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = ((hash << 5) - hash + cardId.charCodeAt(i)) | 0;
  }
  return MACARON_COLORS[Math.abs(hash) % MACARON_COLORS.length];
}

/**
 * 根据 cardId 确定性地生成卡片轻微旋转角度 (±1.5°)
 */
export function getCardRotation(cardId: string): number {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = ((hash << 3) - hash + cardId.charCodeAt(i)) | 0;
  }
  // 映射到 -1.5 ~ 1.5 度
  return ((Math.abs(hash) % 30) - 15) / 10;
}
