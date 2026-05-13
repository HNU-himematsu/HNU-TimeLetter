'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

/**
 * 关于企划 (About Project)
 *
 * 左对齐全屏页面，文案块左锚定、垂直居中、占页面左侧 60% 宽度；
 * 正文沿对角引导线下方自然折行。
 *
 * 引导线几何（与 GuideLine.tsx 保持一致）：
 *   - 直接落在本页的线段为 P3(19.15%·vw, 12.5%·apH) → P4(107.5%·vw, 40.43%·apH)
 *   - 斜率 dy/dx ≈ 27.93%·pageH / 88.35%·vw ≈ 0.316
 *
 * 排版与避让：
 *   - `<motion.div>`: `flex items-center` 将文案块在垂直方向居中；文案块
 *     `w-[60%] px-[5%]` 占页面左侧 60%·vw，内容区 x ∈ [5%, 55%]·vw。
 *   - 垂直居中后，文案块高度约 40vh，纵向跨 y ∈ [~30%, ~70%]·apH；与引导
 *     线 P3→P4 段的 y 范围 [12.5%, 40.43%]·apH 的交集仅在 y ∈ [30%, 40.43%]·apH。
 *     在此 y 范围内，引导线 x 从 ~74.5%·vw 单调增至 107.5%·vw，始终位于
 *     文案块右边缘（x = 60%·vw）之外。文案块天然避让引导线，无需 shape-outside。
 *   - 段落使用 `.text-intro`（视觉规范 §2.2.4），显式 `max-w-none mb-0` 以让出
 *     默认 800px 限宽，让段落充满 60%·vw 列宽；段间间距由父级 `space-y-6` 统一控制。
 */
export function AboutProject() {
  const contentRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(contentRef, { once: true, margin: '-20%' });

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <motion.div
        ref={contentRef}
        className="relative z-10 w-full min-h-screen flex items-center"
        initial={{ opacity: 0, y: 60 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-full md:w-[60%] px-[5%] text-left">
          {/* 标题 —— 使用全局 h2 基准字号（视觉规范 §2.2.1） */}
          <h2 className="mb-10 font-serif text-ink-strong tracking-[0.02em]">
            关于企划
          </h2>

          {/* 正文 —— 开屏页下滚页面群使用大正文（视觉规范 §2.2.4） */}
          <div className="font-sans text-ink space-y-6">
            <p className="text-intro mb-0 max-w-none">
              这是一个聚焦于海大校园、由群友灵感驱动的 AIGC 视觉共创展。
            </p>
            <p className="text-intro mb-0 max-w-none">
              企划发起自海大 Gal 同好群&ldquo;海带姬松书院&rdquo;。我们试图打破次元的边界，将那些原本只存在于游戏屏幕中的少女，
              带入触手可及的真实校园。
            </p>
            <p className="text-intro mb-0 max-w-none">
              这里的每一处选址、每一位登场人物，乃至于画面背后承载的那段微小故事，均脱胎于群友的提案与共创。
              由大家提供喜爱的人物与故事线索，再由制作组借由实景拍摄与 AIGC 技术将其化为现实。
            </p>
            <p className="text-intro mb-0 max-w-none">
              这不仅是一次单向的画集展示，更是一场属于我们的集体记忆创作。我们以这方校园为画框，
              邀你一同拆开这封跨越虚实的&ldquo;海大时光笺&rdquo;。
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
