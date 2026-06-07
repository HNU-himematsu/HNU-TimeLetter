'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import {
  fetchAnnouncementConfig,
  fetchJsapiSignature,
  loadFeishuSdk,
  warmAnnouncement,
  type AnnouncementConfigResponse,
} from '@/lib/announcement-prefetch';

/**
 * 飞书文档内嵌弹窗 (Feishu Doc Modal)
 *
 * 使用飞书网页组件 SDK（云文档组件）将指定飞书文档嵌入页面内弹窗展示，
 * 替代原有的「新标签页跳转」交互方式。
 *
 * 性能策略：
 *  - layout `<head>` 已通过 preconnect / preload 提前建立 TLS 与下载 SDK。
 *  - 组件挂载时立即并行预取 SDK、配置、签名（详见 announcement-prefetch.ts）。
 *  - GlobalNav 在悬停/聚焦「公告」按钮时再次触发预热。
 *  - 整体弹窗 DOM 常驻挂载，仅通过 opacity / pointer-events 切换可见性，
 *    SDK 实例与 iframe 在第一次打开后保留，**关闭/再次打开为 0 成本**。
 *  - 只在组件最终卸载（例如导航至完全不同的路由）时销毁 SDK 实例。
 *
 * 鉴权方式：应用身份（app_access_token）
 * SDK 文档：https://open.feishu.cn/document/uYjL24iN/uYDO3YjL2gzN24iN3cjN/introduction
 */

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type DocComponentInstance = {
  start(): Promise<void>;
  destroy(): void;
  setFeatureConfig(config: Record<string, unknown>): void;
};

export function FeishuDocModal() {
  const isAnnouncementOpen = useAppStore((s) => s.isAnnouncementOpen);
  const closeAnnouncement = useAppStore((s) => s.closeAnnouncement);

  /** SDK 挂载容器 ref（指向 JSX 中的父容器，SDK 的原生挂载节点在其内部独立创建） */
  const containerRef = useRef<HTMLDivElement>(null);
  /** 由原生 DOM API 创建、脱离 React 渲染树的 SDK 挂载节点 */
  const mountNodeRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<DocComponentInstance | null>(null);
  const initVersionRef = useRef(0);
  /* 用于在异步 init 流程中判定当前请求是否已被新的关闭动作取消 */
  const initInFlightRef = useRef(false);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [docUrl, setDocUrl] = useState('');

  /* 组件挂载时立即触发一次预热：SDK + 配置 + 签名并行启动 */
  useEffect(() => {
    warmAnnouncement();
  }, []);

  /* 弹窗打开时锁定 body 滚动，防止背景页面穿透滚动 */
  useEffect(() => {
    if (!isAnnouncementOpen) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    const prevOverflow = document.body.style.overflow;
    const prevOverscrollBehavior = document.body.style.overscrollBehavior;
    const prevPaddingRight = document.body.style.paddingRight;
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscrollBehavior;
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscrollBehavior;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isAnnouncementOpen]);

  const ensureMounted = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    /* 首次调用时创建脱离 React 渲染树的原生挂载节点，避免 React DevTools
       遍历飞书 SDK 创建的跨域 iframe 时触发 SecurityError */
    if (!mountNodeRef.current) {
      const node = document.createElement('div');
      node.className = 'absolute inset-0';
      container.appendChild(node);
      mountNodeRef.current = node;
    }
    const mountNode = mountNodeRef.current;

    /* SDK 实例已就绪：直接复用，省掉重新建立 iframe 的开销 */
    if (instanceRef.current) {
      setStatus('ready');
      return;
    }
    if (initInFlightRef.current) {
      /* 已有一次 init 正在进行中（例如 React 双重 commit），等待其自然完成 */
      return;
    }
    initInFlightRef.current = true;
    const initVersion = initVersionRef.current + 1;
    initVersionRef.current = initVersion;
    setStatus('loading');
    try {
      const pageUrl = window.location.origin + window.location.pathname;

      /* 1. 并行：SDK / 配置 / 签名 —— 全部走模块级单例缓存，命中即返回 */
      const [, announcementCfg, auth] = await Promise.all([
        loadFeishuSdk(),
        fetchAnnouncementConfig(),
        fetchJsapiSignature(pageUrl),
      ]);

      if (initVersion !== initVersionRef.current) return;

      setDocUrl(announcementCfg.docUrl);

      /* 2. 让出主线程一个宏任务，确保 React 当前 commit/work 周期结束后
            再由飞书 SDK 操作 DOM，避免 "Should not already be working" 重入错误 */
      await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
      if (!mountNode || initVersion !== initVersionRef.current) return;
      /* 极端竞态：第二次调用已先创建实例 */
      if (instanceRef.current) {
        setStatus('ready');
        return;
      }

      /* 3. 创建组件：在构造器 config 字段传入功能配置（部分 SDK 版本在此生效） */
      const comp = new window.DocComponentSdk({
        src: announcementCfg.docUrl,
        mount: mountNode,
        auth: {
          signature: auth.signature,
          appId: auth.appId,
          timestamp: auth.timestamp,
          nonceStr: auth.nonceStr,
          url: auth.url,
          jsApiList: ['DocsComponent'],
        },
        config: announcementCfg.featureConfig,
        size: { width: '100%', height: '100%', minHeight: 400 },
        theme: 'light',
        onAuthError: (err: unknown) => {
          const message = err instanceof Error ? err.message : '飞书鉴权失败';
          console.error('[FeishuDocModal] SDK auth error:', err);
          setErrorMsg(message);
          setStatus('error');
        },
        onError: (err) => console.error('[FeishuDocModal] SDK error:', err),
      });

      instanceRef.current = comp;
      await comp.start();

      if (initVersion !== initVersionRef.current) {
        /* 仅当此次 init 已被覆盖时才销毁，避免误伤后续复用 */
        comp.destroy();
        if (instanceRef.current === comp) instanceRef.current = null;
        return;
      }

      /* 4. start() 之后再调用一次，兼容需要挂载后才能生效的 SDK 版本 */
      comp.setFeatureConfig(announcementCfg.featureConfig);

      setStatus('ready');
    } catch (err) {
      if (initVersion !== initVersionRef.current) return;
      const msg = err instanceof Error ? err.message : '未知错误';
      setErrorMsg(msg);
      setStatus('error');
    } finally {
      initInFlightRef.current = false;
    }
  }, []);

  /* 用户打开弹窗时按需初始化；已初始化则零成本复用 iframe */
  useEffect(() => {
    if (isAnnouncementOpen) {
      void ensureMounted();
    }
  }, [isAnnouncementOpen, ensureMounted]);

  /* 组件最终卸载时销毁 SDK 实例（释放 iframe 与监听器）并清理原生挂载节点 */
  useEffect(() => {
    return () => {
      initVersionRef.current += 1;
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
      if (mountNodeRef.current) {
        mountNodeRef.current.remove();
        mountNodeRef.current = null;
      }
    };
  }, []);

  /* ESC 键关闭 */
  useEffect(() => {
    if (!isAnnouncementOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAnnouncement();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAnnouncementOpen, closeAnnouncement]);

  /* 失败重试：点击错误态时清空状态并重新初始化 */
  const retry = useCallback(() => {
    setErrorMsg('');
    setStatus('idle');
    void ensureMounted();
  }, [ensureMounted]);

  /* 关闭时不卸载 iframe：通过 opacity / pointer-events 切换可见性，
     再次打开瞬时显示。outer 容器使用 motion.div 控制淡入淡出。 */
  return (
    <motion.div
      key="announcement-backdrop"
      className="fixed inset-0 flex items-center justify-center"
      data-lenis-prevent
      aria-hidden={!isAnnouncementOpen}
      initial={false}
      animate={{ opacity: isAnnouncementOpen ? 1 : 0 }}
      transition={{ duration: 0.22 }}
      style={{
        zIndex: 1300,
        pointerEvents: isAnnouncementOpen ? 'auto' : 'none',
        visibility: isAnnouncementOpen ? 'visible' : 'hidden',
      }}
    >
      {/* 遮罩 */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15, 8, 8, 0.72)', backdropFilter: 'blur(3px)' }}
        onClick={closeAnnouncement}
        aria-hidden="true"
      />

      {/* 弹窗主体 */}
      <motion.div
        key="announcement-dialog"
        role="dialog"
        aria-modal={isAnnouncementOpen}
        aria-label="活动公告"
        className="relative flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{
          width: 'min(92vw, 960px)',
          height: 'calc(100dvh - 2rem)',
          background: '#F6F1EB',
          border: '1.5px solid #C23643',
        }}
        initial={false}
        animate={isAnnouncementOpen
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{
            background: '#C23643',
            color: '#F6F1EB',
          }}
        >
          <span
            className="font-serif tracking-[0.2em] text-sm select-none"
            style={{ writingMode: 'horizontal-tb' }}
          >
            活动公告
          </span>
          <button
            type="button"
            onClick={closeAnnouncement}
            className="flex items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/20"
            style={{ width: 28, height: 28 }}
            aria-label="关闭公告"
          >
            <svg
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              width={14}
              height={14}
            >
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* 文档挂载区 */}
        <div className="flex-1 overflow-hidden relative">
          {/* SDK 挂载容器：挂载节点由原生 DOM API 在 ensureMounted 中创建，
              脱离 React 渲染树，避免 React DevTools 遍历跨域 iframe */}
          <div ref={containerRef} className="absolute inset-0" />

          {/* 加载态遮罩 */}
          {status === 'loading' && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none"
              style={{ background: '#F6F1EB' }}
            >
              <svg
                className="animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C23643"
                strokeWidth={2}
                width={32}
                height={32}
              >
                <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <span
                className="font-serif tracking-widest text-sm"
                style={{ color: '#563B3B' }}
              >
                加载中…
              </span>
            </div>
          )}

          {/* 错误态 */}
          {status === 'error' && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 select-none"
              style={{ background: '#F6F1EB' }}
            >
              <span
                className="font-serif tracking-wider text-base text-center"
                style={{ color: '#C23643' }}
              >
                文档加载失败
              </span>
              <span
                className="text-xs text-center font-mono"
                style={{ color: '#563B3B', opacity: 0.7 }}
              >
                {errorMsg}
              </span>
              <button
                type="button"
                onClick={retry}
                className="mt-2 text-sm underline underline-offset-2 font-serif tracking-wide"
                style={{ color: '#C23643' }}
              >
                重试 ↻
              </button>
              {docUrl && (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-2 font-serif tracking-wide"
                  style={{ color: '#C23643' }}
                >
                  在飞书中查看原文档 →
                </a>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* 仅用作类型签名稳定，旧代码外部并无消费者引用此响应类型 */
export type { AnnouncementConfigResponse };
