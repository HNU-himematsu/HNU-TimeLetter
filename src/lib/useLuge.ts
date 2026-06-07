'use client';

import { useEffect, useRef } from 'react';
import type { LugeInstance } from '@waaark/luge';

/**
 * Luge 初始化 Hook
 *
 * 在客户端挂载后动态加载 @waaark/luge，作为全局单例管理 Luge 的生命周期。
 * 禁用 Luge 自带的 smooth scroll 插件，避免与 Lenis.js 的平滑滚动冲突。
 *
 * 使用场景：仅在需要 Luge 动效增强（reveal / scroll animation / scroll observer）
 * 且同时使用 Lenis 作为平滑滚动引擎时调用。
 *
 * 示例：
 *   const lugeRef = useLuge(enabled);
 *   // lugeRef.current 为 luge 实例，可在其他逻辑中使用其 API
 */
export function useLuge(enabled = true) {
  const lugeRef = useRef<LugeInstance | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!enabled || initialized.current) return;

    let cancelled = false;

    import('@waaark/luge').then((module) => {
      if (cancelled) return;

      const luge = module.default as LugeInstance;
      lugeRef.current = luge;

      if (typeof luge.settings === 'function') {
        luge.settings({
          smooth: { disabled: true },
        });
      }

      initialized.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return lugeRef;
}
