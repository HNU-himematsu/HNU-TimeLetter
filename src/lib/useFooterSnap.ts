'use client';

import { useEffect, useRef } from 'react';
import Lenis from 'lenis';

/**
 * 页脚吸附 Hook
 *
 * 当用户主动向下滚动、接近页脚区域时（距底部 38vh 以内），
 * 触发一次快速下滑，将固定于视口底部的 Footer 完全揭露出来。
 *
 * 触发条件（三者同时满足）：
 *  1. 滚动方向为向下（direction > 0.5，过滤 LERP 残差噪声）
 *  2. 距底部不足 30vh（limit - scroll <= 0.30 * viewportHeight）
 *  3. 本回合尚未吸附（hasSnapped 为 false）
 *
 * 仅在用户产生向下滚动动作时触发：停留在页脚区域不动、或向上回滚，
 * 均不会触发吸附。向上回滚超过 35% 总可滚动距离后重置标记，
 * 允许再次向下时重新触发。
 *
 * 运动参数：
 *  - lerp: 0.16  逐帧线性插值系数，比 Lenis 默认 0.1 略高
 *  - easing: Expo ease-out (cubic-bezier(0.16, 1, 0.3, 1) 等价)
 *    起速迅猛、末段柔和减速
 *
 * @param lenis - Lenis 实例
 * @param enabled - 是否启用吸附
 */
export function useFooterSnap(lenis: Lenis | null, enabled: boolean) {
  const hasSnapped = useRef(false);
  const prevScroll = useRef(0);

  useEffect(() => {
    if (!enabled || !lenis) return;

    const onScroll = ({ scroll, limit, dimensions }: Lenis) => {
      const current = scroll;
      const direction = current - prevScroll.current;
      prevScroll.current = current;

      // 向上回滚超过 35% 最大可滚动距离时重置吸附标记
      const resetPoint = limit * 0.65;
      if (hasSnapped.current && current < resetPoint) {
        hasSnapped.current = false;
      }

      // 触发吸附：向下滚动 + 距底部不足阈值 + 本回合未触发
      const distanceFromBottom = limit - current;
      const threshold = dimensions.height * 0.35;
      const scrollingDown = direction > 0.5;

      if (!hasSnapped.current && scrollingDown && distanceFromBottom <= threshold) {
        hasSnapped.current = true;
        lenis.scrollTo(limit, {
          lerp: 0.13,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        });
      }
    };

    lenis.on('scroll', onScroll);
    return () => {
      lenis.off('scroll', onScroll);
    };
  }, [enabled, lenis]);
}
