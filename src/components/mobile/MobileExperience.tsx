'use client';

/**
 * MobileExperience: 移动端核心体验容器
 * 负责人: Developer C
 *
 * 整合 StoryFeed, MobileDetailModal 和 StaticMapModal。
 * 详情页打开时锁定 body 滚动，防止穿透。
 */

import { useMemo, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Map as MapIcon } from 'lucide-react';
import { StoryFeed } from './StoryFeed';
import { MobileDetailModal } from './MobileDetailModal';
import { StaticMapModal } from './StaticMapModal';
import type { Story } from '@/lib/types';
import { flattenStoriesWithLocationName } from '@/lib/content';
import { useContentData } from '@/lib/content-store';

export function MobileExperience() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const contentData = useContentData();

  // 详情页或地图打开时锁定 body 滚动，防止穿透
  useEffect(() => {
    document.body.style.overflow = (selectedId || isMapOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedId, isMapOpen]);

  const allStories = useMemo(
    () => flattenStoriesWithLocationName(contentData.locations) as Story[],
    [contentData.locations],
  );
  const currentStory = allStories.find(s => s.id === selectedId) ?? null;

  return (
    <div className="relative w-full h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* 1. Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-stone-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div>
          <h1 className="mb-0 text-xl font-serif text-stone-800 tracking-wider">与她的海大时光笺</h1>
          <p className="text-[10px] text-stone-400 font-sans tracking-[0.2em] mt-0.5">HNU-TimeLetter</p>
        </div>
      </header>

      {/* 2. Story Feed List */}
      <div className="flex-1 overflow-hidden">
        <StoryFeed
          onStoryClick={(story) => setSelectedId(story.id)}
        />
      </div>

      {/* 3. Detail Modal（右侧滑入） */}
      <AnimatePresence mode="wait">
        {currentStory && (
          <MobileDetailModal
            key="detail-modal"
            story={currentStory}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>

      {/* 4. Floating Action Button (FAB) */}
      <motion.button
        className="fixed bottom-8 right-8 w-14 h-14 bg-stone-900 text-white rounded-full shadow-2xl flex items-center justify-center z-30 cursor-pointer"
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsMapOpen(true)}
      >
        <MapIcon className="w-6 h-6" />
      </motion.button>

      {/* 5. Static Map Modal */}
      <StaticMapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} />
    </div>
  );
}
