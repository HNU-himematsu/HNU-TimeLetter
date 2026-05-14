'use client';

import { useState, useEffect, useLayoutEffect, type RefObject } from 'react';

/**
 * 响应式媒体查询 Hook。
 * 基于浏览器 window.matchMedia API 检测屏幕宽度，仅在客户端渲染阶段生效。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    // 初始化时设置状态
    setMatches(media.matches);

    // 监听变化
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/**
 * 检测是否为移动端
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)');
}

export function fitContainedSize(width: number, height: number, aspect: number) {
  const containerAspect = width / height;
  if (containerAspect > aspect) {
    return {
      width: height * aspect,
      height,
    };
  }

  return {
    width,
    height: width / aspect,
  };
}

interface UseContainedMapSizeOptions {
  onContainerResize?: (size: { width: number; height: number }) => void;
  shouldMeasure?: () => boolean;
  /**
   * 容器每侧预留的安全内边距（px）。
   * 用于为包裹层的 border / outline 等「绘制在 width/height 之外」的装饰
   * 预留空间，保证 border-box 不会越过外层 overflow-hidden 的裁剪边界。
   * 参与计算的可用容器尺寸为 (width - 2*insetPx) × (height - 2*insetPx)。
   */
  insetPx?: number;
}

export function useContainedMapSize(
  containerRef: RefObject<HTMLElement | null>,
  mapAspect: number | null,
  options: UseContainedMapSizeOptions = {}
) {
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const { onContainerResize, shouldMeasure, insetPx = 0 } = options;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;

      onContainerResize?.({ width, height });

      if (!mapAspect) return;
      if (shouldMeasure && !shouldMeasure()) return;

      const availW = Math.max(0, width - insetPx * 2);
      const availH = Math.max(0, height - insetPx * 2);
      if (!availW || !availH) {
        setMapSize({ width: 0, height: 0 });
        return;
      }
      setMapSize(fitContainedSize(availW, availH, mapAspect));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [containerRef, mapAspect, onContainerResize, shouldMeasure, insetPx]);

  return mapSize;
}
