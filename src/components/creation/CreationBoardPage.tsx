'use client';

import type { CardHeaderInfo, CreationIdea } from '@/lib/types';
import { groupIdeasToCards } from './utils';
import CreationBoardHeader from './CreationBoardHeader';
import CreationMasonry from './CreationMasonry';

interface CreationBoardPageProps {
  ideas: CreationIdea[];
  headers: CardHeaderInfo[];
}

export default function CreationBoardPage({ ideas, headers }: CreationBoardPageProps) {
  const cards = groupIdeasToCards(ideas, headers);

  return (
    <div className="relative min-h-dvh bg-background">
      {/* 网格草稿线背景 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '28px 28px',
        }}
      />

      {/* 内容层 */}
      <div className="relative z-10">
        <CreationBoardHeader />
        <main className="pb-16">
          <CreationMasonry cards={cards} />
        </main>
      </div>
    </div>
  );
}
