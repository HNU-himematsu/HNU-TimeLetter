'use client';

import { useMemo } from 'react';
import type { CreationCard } from '@/lib/types';
import { getCardColor } from './utils';
import CreationNoteEntry from './CreationNoteEntry';

interface CreationNoteCardProps {
  card: CreationCard;
}

export default function CreationNoteCard({ card }: CreationNoteCardProps) {
  const bgColor = getCardColor(card.cardId);
  const tiltAngle = useMemo(() => (Math.random() * 2 - 1).toFixed(2), []);

  return (
    <div
      className="relative break-inside-avoid mb-5
                 transition-all duration-200 ease-out"
      style={{
        backgroundColor: bgColor,
        transform: `rotate(${tiltAngle}deg)`,
        boxShadow: '2px 3px 12px rgba(69,39,40,0.08)',
        borderRadius: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `rotate(${tiltAngle}deg) translateY(-4px)`;
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(69,39,40,0.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${tiltAngle}deg)`;
        e.currentTarget.style.boxShadow = '2px 3px 12px rgba(69,39,40,0.08)';
      }}
    >
      {/* 顶部栏：地点/角色胶囊 */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {card.location && (
            <span
              className="inline-block text-[11px] leading-none px-3 py-1.5
                         bg-white/60 border border-black/[0.1] text-ink-muted"
              style={{ borderRadius: '9999px' }}
            >
              {card.location}
            </span>
          )}
          {card.character && (
            <span
              className="inline-block text-[11px] leading-none px-3 py-1.5
                         bg-white/60 border border-black/[0.1] text-ink-muted"
              style={{ borderRadius: '9999px' }}
            >
              {card.character}
            </span>
          )}
        </div>
      </div>

      {/* 卡片内部堆叠项 */}
      <div className="pt-1">
        {card.entries.map((entry, idx) => (
          <CreationNoteEntry
            key={entry.id}
            entry={entry}
            isLast={idx === card.entries.length - 1}
          />
        ))}
      </div>

      {/* 底部：新增创意按钮（居中，75%宽度） */}
      <div className="flex justify-center px-4 pb-4 pt-2">
        <a
          href={card.addIdeaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1 w-3/4
                     border border-[#c23643] bg-transparent px-3 py-1.5
                     text-[11px] leading-none text-stone-800
                     transition-colors duration-150 hover:bg-[#c23643] hover:text-white"
          style={{ borderRadius: '9999px' }}
        >
          <span className="text-[12px] leading-none">+</span>
          <span>新增创意</span>
        </a>
      </div>

      {/* 底部装饰线 — 模拟便签撕裂边缘 */}
      <div
        className="h-[3px] w-full opacity-20"
        style={{
          background: `repeating-linear-gradient(90deg, ${bgColor} 0px, ${bgColor} 4px, transparent 4px, transparent 8px)`,
        }}
      />
    </div>
  );
}
