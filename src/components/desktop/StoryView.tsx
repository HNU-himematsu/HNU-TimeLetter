'use client';

import { useCallback, useEffect, useState } from 'react';
import { Story } from '@/lib/types';
import { StoryCardStack } from './StoryCardStack';
import { StoryTextArea } from './StoryTextArea';

interface StoryViewProps {
  stories: Story[];
}

export function StoryView({ stories }: StoryViewProps) {
  const [activeIndices, setActiveIndices] = useState(stories.map((_, i) => i));
  const [isTextVisible, setIsTextVisible] = useState(false);

  useEffect(() => {
    setActiveIndices(stories.map((_, i) => i));
    setIsTextVisible(false);
  }, [stories]);

  const topIndex = activeIndices[0];
  const topStory = stories[topIndex];

  const handleSwipe = useCallback(() => {
    setActiveIndices((prev) => {
      const next = [...prev];
      const first = next.shift();
      if (first !== undefined) next.push(first);
      return next;
    });
  }, []);

  const handleSelect = useCallback(() => {
    setIsTextVisible((prev) => !prev);
  }, []);

  return (
    <div
      className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center pt-10 pb-20 select-none scrollbar-hide"
      onClick={() => setIsTextVisible(false)}
    >
      {stories.length > 0 ? (
        <>
          <div className="w-full flex-shrink-0">
            <StoryCardStack
              stories={stories}
              activeIndices={activeIndices}
              onSwipe={handleSwipe}
              onSelect={handleSelect}
            />
          </div>

          <div className="w-full flex-shrink-0 px-4 mt-[-50px] z-10">
            <StoryTextArea story={topStory} isVisible={isTextVisible} />
          </div>

          <div
            className={`w-full flex-shrink-0 transition-[height] duration-300 ${isTextVisible ? 'h-8' : 'h-28 md:h-40 lg:h-48'
              }`}
          />
        </>
      ) : (
        <div className="flex min-h-full w-full items-center justify-center px-8">
          <div className="max-w-xl rounded-[32px] border border-[#e7ddcf] bg-white/90 px-10 py-12 text-center shadow-[0_24px_80px_rgba(120,84,48,0.12)]">
            <p className="font-serif text-3xl tracking-[0.2em] text-stone-700">空地点</p>
            <p className="mt-4 font-serif text-base leading-8 text-stone-500">
              这里的 pin 已经就位，但故事卡片还没有被写进时光笺
            </p>
          </div>
        </div>
      )}
    </div >
  );
}
