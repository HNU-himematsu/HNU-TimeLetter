/**
 * 飞书公告弹窗：共享预取层 (Announcement Prefetch Layer)
 *
 * 集中管理飞书云文档组件加载所需的三类网络资源：
 *  1. SDK 脚本（跨页面只下载一次）
 *  2. 公告配置（/api/announcement-config）
 *  3. JSAPI 签名（/api/feishu-jsapi-signature?url=...，按 URL 缓存）
 *
 * 模块顶层维持 Promise 单例，任意触发点重复调用都会复用同一份 Promise，
 * 失败时清空缓存允许重试。结合 layout 头部的 <link rel="preload"/preconnect>，
 * 让弹窗在用户真正点击之前就完成尽可能多的握手与下载。
 */
'use client';

export const FEISHU_SDK_URL =
  'https://sf1-scmcdn-cn.feishucdn.com/obj/feishu-static/docComponentSdk/lib/1.0.13.js';

export interface AnnouncementConfigResponse {
  docUrl: string;
  featureConfig: Record<string, unknown>;
  error?: string;
}

export interface JsapiSignatureResponse {
  signature: string;
  appId: string;
  timestamp: number;
  nonceStr: string;
  url: string;
  error?: string;
}

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
      onAuthError?: (err: unknown) => void;
      onError?: (err: unknown) => void;
      onMountSuccess?: () => void;
    }) => {
      start(): Promise<void>;
      destroy(): void;
      setFeatureConfig(config: Record<string, unknown>): void;
    };
  }
}

let sdkPromise: Promise<void> | null = null;
let configPromise: Promise<AnnouncementConfigResponse> | null = null;
let signaturePromise: Promise<JsapiSignatureResponse> | null = null;
let cachedSignatureUrl: string | null = null;

function isSdkReady(): boolean {
  return typeof window !== 'undefined' && typeof window.DocComponentSdk !== 'undefined';
}

function createSdkScript(resolve: () => void, reject: (error: Error) => void) {
  const script = document.createElement('script');
  script.src = FEISHU_SDK_URL;
  script.async = true;
  script.setAttribute('data-feishu-sdk', 'true');
  script.dataset.loadState = 'loading';
  script.onload = () => {
    script.dataset.loadState = 'loaded';
    if (isSdkReady()) {
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

export function loadFeishuSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('loadFeishuSdk: window is undefined'));
  }
  if (isSdkReady()) {
    return Promise.resolve();
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    if (isSdkReady()) {
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
        if (isSdkReady()) {
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
      existing.addEventListener('error', handleError, { once: true });
      return;
    }
    createSdkScript(resolve, reject);
  }).catch((err) => {
    sdkPromise = null;
    throw err;
  });
  return sdkPromise;
}

export function fetchAnnouncementConfig(): Promise<AnnouncementConfigResponse> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('fetchAnnouncementConfig: window is undefined'));
  }
  if (configPromise) return configPromise;

  configPromise = fetch('/api/announcement-config', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('公告配置接口异常');
      return r.json() as Promise<AnnouncementConfigResponse>;
    })
    .then((d) => {
      if (d.error) throw new Error(d.error);
      return d;
    })
    .catch((err) => {
      configPromise = null;
      throw err;
    });
  return configPromise;
}

export function fetchJsapiSignature(url: string): Promise<JsapiSignatureResponse> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('fetchJsapiSignature: window is undefined'));
  }
  if (signaturePromise && cachedSignatureUrl === url) return signaturePromise;

  cachedSignatureUrl = url;
  signaturePromise = fetch(`/api/feishu-jsapi-signature?url=${encodeURIComponent(url)}`)
    .then((r) => r.json() as Promise<JsapiSignatureResponse>)
    .then((d) => {
      if (d.error) throw new Error(d.error);
      return d;
    })
    .catch((err) => {
      signaturePromise = null;
      cachedSignatureUrl = null;
      throw err;
    });
  return signaturePromise;
}

/**
 * 触发一次「公告弹窗」的资源预热：
 * 并行下载 SDK、拉取公告配置与 JSAPI 签名。
 *
 * 调用场景：
 *  - FeishuDocModal 挂载（页面级最早可控时机）
 *  - 用户悬停 / 聚焦 / 触屏「公告」按钮（强意图信号）
 *
 * 不抛错；任意失败仅清空对应 Promise 等待下次重试。
 */
export function warmAnnouncement(): void {
  if (typeof window === 'undefined') return;
  const pageUrl = window.location.origin + window.location.pathname;
  void loadFeishuSdk().catch(() => {});
  void fetchAnnouncementConfig().catch(() => {});
  void fetchJsapiSignature(pageUrl).catch(() => {});
}
