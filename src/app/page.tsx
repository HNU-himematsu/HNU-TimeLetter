'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useIsMobile } from '@/lib/hooks';
import { useVirtualScroll } from '@/lib/useVirtualScroll';
import { EnvelopeIntro } from '@/components/shared/EnvelopeIntro';
import { ScrollSections } from '@/components/sections/ScrollSections';
import { Footer } from '@/components/sections/Footer';
import { CustomScrollbar } from '@/components/shared/CustomScrollbar';

export default function Home() {
  const { isIntroReady, isTransitioning, isAnnouncementOpen } = useAppStore();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  // 开屏入场动画期间禁止下滑：仅在入场动画播完且未处于跳转过渡时启用 Lenis 与自定义滑块
  const lenis = useVirtualScroll(
    mounted && !isMobile && isIntroReady && !isTransitioning && !isAnnouncementOpen,
  );
  const scrollbarEnabled =
    mounted && !isMobile && isIntroReady && !isTransitioning && !isAnnouncementOpen;

  // mounted 标志确保客户端渲染完成后才启用 Lenis 与自定义滚动条
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.add('home-scrollbar-hidden');
    document.body.classList.add('home-scrollbar-hidden');

    return () => {
      document.documentElement.classList.remove('home-scrollbar-hidden');
      document.body.classList.remove('home-scrollbar-hidden');
    };
  }, []);

  // 开屏动画未播完时锁定纵向滚动（开信期间由 EnvelopeIntro 内部追加同名类，路由切至 /map 前继续锁定）
  useEffect(() => {
    const locked = mounted && !isIntroReady;
    if (locked) {
      document.documentElement.classList.add('intro-scroll-locked');
      document.body.classList.add('intro-scroll-locked');
      return () => {
        document.documentElement.classList.remove('intro-scroll-locked');
        document.body.classList.remove('intro-scroll-locked');
      };
    }
  }, [mounted, isIntroReady]);

  // 首渲即输出完整组件树（含 EnvelopeIntro / ScrollSections / Footer）——
  // EnvelopeIntro 内部 SSR 即输出 Base Layer (cream + #c23643 polygon clip-path)，
  // 保证大斜底色块从首帧即在，避免 hydration 时刻才挂载导致闪屏。
  // Top Layer / 信封 / Lenis 等需要 viewport 的部分由各自的 `vw > 0` / `mounted` 自门控。

  return (
    <main className="relative w-full min-h-dvh">
      {/* ── 页脚：固定在视口底部 z-0，被上方内容遮盖 ── */}
      <Footer />

      {/* ── 信封开屏 + 向下滚动延伸页面 ── */}
      <div className="relative w-full" style={{ zIndex: 1 }}>
        {/* 首屏：信封 — EnvelopeIntro 自带 page-paper 背景 */}
        <EnvelopeIntro />

        {/* 下滚页面群 — ScrollSections 自带 page-paper 背景 */}
        <ScrollSections />
      </div>

      {/* 页脚占位空间 — 置于 z-1 容器之外，让点击穿透到固定页脚 */}
      <FooterSpacer />

      {/* ── 自定义滑块：与 Lenis 同步的 DOM 滚动条 ── */}
      <CustomScrollbar enabled={scrollbarEnabled} lenis={lenis} />
    </main>
  );
}

/**
 * 页脚占位组件：测量固定页脚高度，在文档流中腾出相同空间。
 * 滚动到此区域时，固定页脚从底部被"揭露"。
 * 注意：不设置背景色，保持透明，让下方固定页脚可见。
 */
function FooterSpacer() {
  const [h, setH] = useState(0);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;

    const measure = () => setH(footer.offsetHeight);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(footer);
    return () => ro.disconnect();
  }, []);

  return <div style={{ height: h, pointerEvents: 'none' }} aria-hidden="true" />;
}
