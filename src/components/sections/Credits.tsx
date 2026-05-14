'use client';

import { useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import type { Contributor } from '@/lib/types';
import { useContributorsData } from '@/lib/content-store';

/**
 * 鸣谢 (Credits)
 *
 * 全屏页面，整体偏右对齐。
 * - 上部：鸣谢文案
 * - 下部：参与贡献名单 — 三排横向无限滚动昵称展示区
 *
 * 引导线几何（与 GuideLine.tsx 保持一致）：
 *   - P4→P5 段在 Credits 顶部穿入，x 从 ~30%·vw 下滑至 P5(-2.19%·vw, 65.40%·crH)
 *   - P5→P6 段向右下延伸至 P6(32%·vw, crBottom + 80)
 *   - 本页引导线始终落在 x < ~32%·vw 的左侧区域
 *
 * 避让策略：
 *   - 正文整体 `ml-auto` + `pr-*` 右锚定，段落 `.text-intro` 800px 限宽使
 *     行左端保持在 ~39%·vw 附近，天然位于引导线右侧。
 *   - 顶部鸣谢文案块内放置 `float: left` 的 shape-outside 三角占位，进一步
 *     沿 P4→P5 方向退让首段行首，避免在窄视口下擦边。
 */

const rowCount = 3;

function MarqueeRow({
  items,
  speed = 30,
  reverse = false,
}: {
  items: Contributor[];
  speed?: number;
  reverse?: boolean;
}) {
  if (!items || items.length === 0) return null;

  // 复制 20 份实现无尽的轨道铺排（确保就算是只有几个名字，也能完全铺满屏幕）
  // 只要是偶数份，跑马灯 -50% 的位移就能保证正好无缝衔接回起点
  const copies = 20;
  const multiplied = Array.from({ length: copies }).flatMap(() => items);
  
  // shiftMultiplier = copies / 2 = 10，将 20 份副本映射为常量视觉速度
  const shiftMultiplier = copies / 2;
  // 动画时长随 items 数量线性增长，以 0.5 倍基数 + 60s 下限营造电影谢幕感
  const duration = Math.max(items.length * shiftMultiplier * speed * 0.5, 60);

  return (
    <div className="relative overflow-hidden whitespace-nowrap py-3 w-full">
      <motion.div
        className="inline-flex gap-8"
        animate={{ x: reverse ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{
          x: {
            duration: duration,
            repeat: Infinity,
            ease: 'linear',
          },
        }}
      >
        {multiplied.map((item, i) => (
          <span
            key={`${item.id}-${i}`}
            className="text-ink-muted text-sm md:text-base font-sans tracking-widest opacity-60 hover:opacity-100 transition-opacity"
            title={item.message || item.role || item.name}
          >
            {item.name}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export function Credits() {
  const contentRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(contentRef, { once: true, margin: '-20%' });
  const { contributors } = useContributorsData();
  const contributorRows = useMemo(() => {
    const rows: Contributor[][] = Array.from({ length: rowCount }, () => []);
    contributors.forEach((contributor, index) => {
      rows[index % rowCount].push(contributor);
    });
    return rows;
  }, [contributors]);

  return (
    <section className="relative w-full min-h-screen flex flex-col justify-center overflow-hidden">
      <motion.div
        ref={contentRef}
        className="relative z-10 w-full max-w-6xl ml-auto px-8 md:px-16 lg:pr-24 py-20"
        initial={{ opacity: 0, y: 60 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* 鸣谢文案 —— 使用全局 h2 基准字号与大正文 */}
        <div className="text-right mb-16">
          {/*
           * shape-outside 左侧避让：引导线 P4→P5 从 Credits 顶部
           * x~30%·vw 斜向下穿入，本占位块推开首段首行的左端，使行文沿
           * 对角展开；polygon 斜边方向与引导线一致。
           */}
          <div
            aria-hidden
            className="hidden md:block float-left"
            style={{
              width: '18%',
              height: '14vh',
              shapeOutside: 'polygon(0 0, 100% 0, 0 100%)',
            }}
          />
          <h2 className="font-serif text-ink-strong tracking-[0.02em]">
            鸣谢
          </h2>
          <p className="text-intro font-sans text-ink ml-auto mb-0">
            感谢每一位参与共创的群友，是你们的灵感与热情让这个企划从一个简单的想法，生长为一场真实的视觉展览。每一个角色、每一处场景的背后，都有你们的身影。
          </p>
        </div>

        {/* 参与贡献名单 */}
        <div className="mt-8">
          <h3 className="font-serif text-ink-strong tracking-wide text-right mb-6">
            参与贡献名单
          </h3>
          <div className="space-y-2">
            {contributorRows.map((row, i) => (
              <MarqueeRow
                key={i}
                items={row}
                speed={25 + i * 8}
                reverse={i % 2 === 1}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
