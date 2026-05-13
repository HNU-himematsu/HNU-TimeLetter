'use client';

import { useRef } from 'react';
import { AboutProject } from './AboutProject';
import { AboutUs } from './AboutUs';
import { Credits } from './Credits';
import { GuideLine } from '@/components/shared/GuideLine';
import { useIsMobile } from '@/lib/hooks';

/**
 * ScrollSections — 下滚页面群包装组件
 *
 * 包含"关于企划"、"关于我们"、"鸣谢"三个全屏页面，
 * 以及横跨其间的红色引导线。
 *
 * 图层顺序（从下到上）：
 *  - 背景色 #ece9e4（由 page-paper 提供）
 *  - 引导线 z-[1]
 *  - 文字内容 z-[10]（各 section 内部内容）
 *
 * 注意：Footer 不在 ScrollSections 中，它作为独立固定层
 * 放在 page.tsx 中，通过揭露式视差动画呈现。
 */
export function ScrollSections() {
  const aboutProjectRef = useRef<HTMLDivElement>(null);
  const aboutUsRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  return (
    <div className="relative page-paper">
      {/* 红色引导线 — z-[1]，在背景上方、文字下方；移动端不显示 */}
      {!isMobile && <GuideLine sectionRefs={[aboutProjectRef, aboutUsRef, creditsRef]} />}

      {/* 三个全屏页面 — 背景透明，文字内容 z-[10] 在引导线上方 */}
      <div ref={aboutProjectRef} className="relative">
        <AboutProject />
      </div>
      <div ref={aboutUsRef} className="relative">
        <AboutUs />
      </div>
      <div ref={creditsRef} className="relative">
        <Credits />
      </div>
    </div>
  );
}
