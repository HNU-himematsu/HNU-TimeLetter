'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';

/**
 * 飞书文档内嵌弹窗 (Feishu Doc Modal)
 *
 * 使用飞书网页组件 SDK（云文档组件）将指定飞书文档嵌入页面内弹窗展示，
 * 替代原有的「新标签页跳转」交互方式。
 *
 * 鉴权方式：应用身份（app_access_token）
 * SDK 文档：https://open.feishu.cn/document/uYjL24iN/uYDO3YjL2gzN24iN3cjN/introduction
 */

const SDK_URL =
  'https://sf1-scmcdn-cn.feishucdn.com/obj/feishu-static/docComponentSdk/lib/1.0.13.js';

/* ── 全局类型声明 ── */
interface FeishuAuth {
  signature: string;
  appId: string;
  timestamp: number;
  nonceStr: string;
  url: string;
  jsApiList: string[];
  openId?: string;
}

declare global {
  interface Window {
    DocComponentSdk: new (config: {
      src: string;
      mount: Element;
      auth: FeishuAuth;
      config?: Record<string, unknown>;
      size?: { width?: string | number; height?: string | number; minHeight?: string | number };
      theme?: 'light' | 'dark';
      onError?: (err: unknown) => void;
      onMountSuccess?: () => void;
    }) => {
      start(): Promise<void>;
      destroy(): void;
      setFeatureConfig(config: Record<string, unknown>): void;
    };
  }
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AnnouncementConfigResponse {
  docUrl: string;
  featureConfig: Record<string, unknown>;
  error?: string;
}

interface JsapiSignatureResponse {
  signature: string;
  appId: string;
  timestamp: number;
  nonceStr: string;
  url: string;
  error?: string;
}

type DocComponentInstance = {
  start(): Promise<void>;
  destroy(): void;
  setFeatureConfig(config: Record<string, unknown>): void;
};

function createSdkScript(resolve: () => void, reject: (error: Error) => void) {
  const script = document.createElement('script');
  script.src = SDK_URL;
  script.async = true;
  script.setAttribute('data-feishu-sdk', 'true');
  script.dataset.loadState = 'loading';
  script.onload = () => {
    script.dataset.loadState = 'loaded';
    if (typeof window.DocComponentSdk !== 'undefined') {
      resolve();
      return;
    }
    script.remove();
    reject(new Error('飞书 SDK 加载失败'));
  };
  script.onerror = () => {
    script.dataset.loadState = 'error';
    script.remove();
    reject(new Error('飞书 SDK 加载失败'));
  };
  document.head.appendChild(script);
}

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.DocComponentSdk !== 'undefined') {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('[data-feishu-sdk]');
    if (existing) {
      if (existing.dataset.loadState === 'error') {
        existing.remove();
        createSdkScript(resolve, reject);
        return;
      }
      const handleLoad = () => {
        if (typeof window.DocComponentSdk !== 'undefined') {
          resolve();
          return;
        }
        existing.remove();
        reject(new Error('飞书 SDK 加载失败'));
      };
      const handleError = () => {
        existing.dataset.loadState = 'error';
        existing.remove();
        reject(new Error('飞书 SDK 加载失败'));
      };
      if (existing.dataset.loadState === 'loaded') {
        handleLoad();
        return;
      }
      existing.addEventListener('load', handleLoad, { once: true });
      existing.addEventListener('error', handleError, {
        once: true,
      });
      return;
    }
    createSdkScript(resolve, reject);
  });
}

interface PreloadState {
  config: AnnouncementConfigResponse | null;
  auth: JsapiSignatureResponse | null;
  authFetchedAt: number;
}

export function FeishuDocModal() {
  const { isAnnouncementOpen, closeAnnouncement } = useAppStore();
  const mountRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<DocComponentInstance | null>(null);
  const preloadRef = useRef<PreloadState>({ config: null, auth: null, authFetchedAt: 0 });
  const initVersionRef = useRef(0);
  const openStateRef = useRef(isAnnouncementOpen);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [docUrl, setDocUrl] = useState('');

  useEffect(() => {
    openStateRef.current = isAnnouncementOpen;
  }, [isAnnouncementOpen]);

  /* 组件挂载时并行预载 SDK、配置、签名，降低弹窗首次打开延迟 */
  useEffect(() => {
    const pageUrl = window.location.origin + window.location.pathname;
    void Promise.all([
      loadSdk().catch(() => {}),
      fetch('/api/announcement-config', { cache: 'no-store' })
        .then((r) => (r.ok ? (r.json() as Promise<AnnouncementConfigResponse>) : null))
        .then((d) => { if (d && !d.error) preloadRef.current.config = d; })
        .catch(() => {}),
      fetch(`/api/feishu-jsapi-signature?url=${encodeURIComponent(pageUrl)}`)
        .then((r) => (r.ok ? (r.json() as Promise<JsapiSignatureResponse>) : null))
        .then((d) => {
          if (d?.signature) {
            preloadRef.current.auth = d;
            preloadRef.current.authFetchedAt = Date.now();
          }
        })
        .catch(() => {}),
    ]);
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

  const teardown = useCallback(() => {
    initVersionRef.current += 1;
    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }
    setStatus('idle');
    setErrorMsg('');
  }, []);

  const init = useCallback(async () => {
    if (!mountRef.current) return;
    const initVersion = initVersionRef.current + 1;
    initVersionRef.current = initVersion;
    setStatus('loading');
    try {
      const pageUrl = window.location.origin + window.location.pathname;
      const SIG_MAX_AGE_MS = 4 * 60 * 1000;
      const now = Date.now();

      /* 1. 并行：SDK（已预载则即返回）+ 配置 + 签名（优先复用预载缓存） */
      const [, announcementCfg, auth] = await Promise.all([
        loadSdk(),
        fetch('/api/announcement-config', { cache: 'no-store' }).then(
          (r) => r.json() as Promise<AnnouncementConfigResponse>,
        ),
        preloadRef.current.auth &&
        preloadRef.current.auth.url === pageUrl &&
        now - preloadRef.current.authFetchedAt < SIG_MAX_AGE_MS
          ? Promise.resolve(preloadRef.current.auth)
          : fetch(`/api/feishu-jsapi-signature?url=${encodeURIComponent(pageUrl)}`).then(
              (r) => r.json() as Promise<JsapiSignatureResponse>,
            ),
      ]);

      if (initVersion !== initVersionRef.current || !openStateRef.current) {
        return;
      }

      if (announcementCfg.error) throw new Error(announcementCfg.error ?? '公告配置接口异常');
      if (auth.error) throw new Error(auth.error ?? '鉴权接口异常');
      preloadRef.current.config = announcementCfg;
      preloadRef.current.auth = auth;
      preloadRef.current.authFetchedAt = now;
      setDocUrl(announcementCfg.docUrl);

      /* 3. 让出主线程一个宏任务，确保 React 当前 commit/work 周期结束后
            再由飞书 SDK 操作 DOM，避免 "Should not already be working" 重入错误 */
      await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
      if (!mountRef.current || initVersion !== initVersionRef.current || !openStateRef.current) return;

      /* 4. 创建组件：在构造器 config 字段传入功能配置（部分 SDK 版本在此生效） */
      const comp = new window.DocComponentSdk({
        src: announcementCfg.docUrl,
        mount: mountRef.current,
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
        onError: (err) => console.error('[FeishuDocModal] SDK error:', err),
      });

      instanceRef.current = comp;
      await comp.start();

      if (initVersion !== initVersionRef.current || !openStateRef.current) {
        comp.destroy();
        if (instanceRef.current === comp) {
          instanceRef.current = null;
        }
        return;
      }

      /* 4. start() 之后再调用一次，兼容需要挂载后才能生效的 SDK 版本 */
      comp.setFeatureConfig(announcementCfg.featureConfig);

      setStatus('ready');
    } catch (err) {
      if (initVersion !== initVersionRef.current || !openStateRef.current) {
        return;
      }
      const msg = err instanceof Error ? err.message : '未知错误';
      setErrorMsg(msg);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (isAnnouncementOpen) {
      void init();
    } else {
      teardown();
    }
  }, [isAnnouncementOpen, init, teardown]);

  /* ESC 键关闭 */
  useEffect(() => {
    if (!isAnnouncementOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAnnouncement();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAnnouncementOpen, closeAnnouncement]);

  return (
    <AnimatePresence>
      {isAnnouncementOpen && (
        <motion.div
          key="announcement-backdrop"
          className="fixed inset-0 flex items-center justify-center"
          data-lenis-prevent
          style={{ zIndex: 1300 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
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
            aria-modal="true"
            aria-label="活动公告"
            className="relative flex flex-col rounded-lg overflow-hidden shadow-2xl"
            style={{
              width: 'min(92vw, 960px)',
              height: 'calc(100dvh - 2rem)',
              background: '#F6F1EB',
              border: '1.5px solid #C23643',
            }}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
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
              {/* SDK 挂载节点 */}
              <div ref={mountRef} className="absolute inset-0" />

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
                  {docUrl && (
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-sm underline underline-offset-2 font-serif tracking-wide"
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
      )}
    </AnimatePresence>
  );
}
