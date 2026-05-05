'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import type { Story } from '@/lib/types';
import { flattenStoriesWithLocationName, getStoryAvatarUrl, getStoryMainImageUrl } from '@/lib/content';
import { useContentData } from '@/lib/content-store';

interface StoryFeedProps {
  onStoryClick: (story: Story) => void;
}

/**
 * StoryCard: 单个故事卡片组件
 * 包含缩略图、角色名和地点信息
 */
function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
      }}
      className="flex flex-col bg-white rounded-[8px] shadow-sm border border-stone-100 overflow-hidden cursor-pointer mb-2 break-inside-avoid"
      onClick={onClick}
      whileTap={shouldReduceMotion ? {} : { scale: 0.96 }}
    >
      <div className="relative w-full min-h-40 bg-stone-100">
        <Image
          src={getStoryMainImageUrl(story)}
          alt={story.characterName}
          width={320}
          height={420}
          className="h-auto w-full object-cover"
          sizes="50vw"
        />
      </div>

      <div className="p-3 bg-white">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="relative w-5 h-5 rounded-full overflow-hidden border border-stone-100 flex-shrink-0">
            <Image
              src={getStoryAvatarUrl(story)}
              alt={story.characterName}
              fill
              className="object-cover"
              sizes="20px"
            />
          </div>
          <span className="text-[10px] text-stone-400 font-serif truncate">
            {story.locationName}
          </span>
        </div>
        <h3 className="mb-0 text-[13px] font-serif text-stone-800 line-clamp-1 leading-tight">
          {story.characterName}
        </h3>
      </div>
    </motion.div>
  );
}

/**
 * StoryFeed: 移动端瀑布流列表
 * 负责人: Developer C
 */
export function StoryFeed({ onStoryClick }: StoryFeedProps) {
  const contentData = useContentData();
  const allStories = useMemo(() => {
    return flattenStoriesWithLocationName(contentData.locations) as Story[];
  }, [contentData.locations]);

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden scrollbar-hide">
      <div className="px-4 py-6">
        <motion.div
          className="columns-2 gap-2"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.06 }
            }
          }}
        >
          {allStories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              onClick={() => onStoryClick(story)}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
