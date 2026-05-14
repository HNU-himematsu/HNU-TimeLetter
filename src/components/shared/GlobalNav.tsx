'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGroup,
  motion,
  useReducedMotion,
  type Transition,
} from 'framer-motion';
import { useAppStore } from '@/lib/store';


/**
 * 全局导航栏 (Global Navigation Bar)
 *
 * 以轻量悬浮姿态常驻于视口右上角，跨越所有页面保持位置不变，
 * 服务于「主页 / 地图 / 公示板」三个顶层视觉阶段之间的切换。
 *
 * 堆叠关系（由下至上）：
 *   页面内容 → CustomScrollbar (z-1000) → 胶囊
 * 外层容器 z-[1100]，高于滑块轨道；胶囊 z-10。
 *
 * 视觉规格参见 `docs/design/交互设计.md#1.4 全局导航栏`。
 */

type NavKey = 'home' | 'map' | 'board';

const ITEMS: { key: NavKey; label: string }[] = [
  { key: 'home', label: '主页' },
  { key: 'map', label: '地图' },
  { key: 'board', label: '公示板' },
];

export function GlobalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { setEnvelopeOpened, setIntroReady, openAnnouncement } = useAppStore();
  const shouldReduceMotion = useReducedMotion();

  // 不在后台管理路由下渲染
  if (pathname?.startsWith('/admin')) return null;

  // 感知当前视觉阶段：纯路由判定
  // - `/creation` → 公示板
  // - `/map`      → 地图
  // - 其余（含 `/`） → 主页
  const active: NavKey =
    pathname === '/creation'
      ? 'board'
      : pathname === '/map'
        ? 'map'
        : 'home';

  const handleClick = (key: NavKey) => {
    if (key === 'board') {
      if (pathname !== '/creation') router.push('/creation');
      return;
    }
    if (key === 'home') {
      // 只在从非 `/` 回 `/` 时才重置：
      // 已在 `/` 上时，`EnvelopeIntro` 入场 effect 依赖稳定不会重跑——
      // 如果这里直接 `setIntroReady(false)` 会令 `page.tsx` 的 `locked = mounted && !isIntroReady`
      // 立即成立且永远无法回调 `setIntroReady(true)`，导致页面被永久锁滚。
      if (pathname !== '/') {
        setEnvelopeOpened(false);
        setIntroReady(false);
        router.push('/');
      }
      return;
    }
    // key === 'map'
    if (pathname !== '/map') router.push('/map');
  };

  // prefers-reduced-motion：弱化/关闭动效，保留最终态
  const pillTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 420, damping: 38 };

  return (
    <div
      // 钉视口右上角的画框内缘；z 高于 CustomScrollbar(z-[1000])，使红背景能覆盖滑块轨道区。
      // top / right 偏移 --site-frame-border-width，确保整组导航位于 5px 白色画框之内。
      className="fixed z-[1100] pointer-events-none select-none"
      style={{
        top: 'var(--site-frame-border-width)',
        right: 'var(--site-frame-border-width)',
      }}
      aria-label="全局导航"
    >
      {/* 胶囊 + 公告按钮：竖向排列，居中对齐，top 留 2.5vh，right 贴视口更紧 */}
      <div
        className="pointer-events-auto absolute flex flex-col items-center gap-2"
        style={{
          top: '2.5vh',
          right: '0.8vw',
          zIndex: 10,
        }}
      >
        <LayoutGroup id="global-nav">
          <ul
            className="relative flex flex-col items-stretch rounded-full border backdrop-blur-md shadow-sm"
            style={{
              borderColor: '#c23643',
              background: 'rgba(246, 241, 235, 0.55)',
              width: '4vw',
              minWidth: 44,
              maxWidth: 64,
              padding: '5px',
            }}
          >
            {ITEMS.map((item) => {
              const isActive = active === item.key;
              return (
                <li key={item.key} className="relative">
                  {isActive && (
                    <motion.span
                      layoutId="global-nav-pill"
                      className="absolute inset-0 rounded-full"
                      style={{ background: '#c23643' }}
                      transition={pillTransition}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleClick(item.key)}
                    aria-current={isActive ? 'page' : undefined}
                    className="relative w-full flex items-center justify-center font-serif tracking-[0.18em] transition-colors duration-200"
                    style={{
                      writingMode: 'vertical-rl',
                      color: isActive ? '#ffffff' : '#563B3B',
                      paddingTop: '18px',
                      paddingBottom: '18px',
                      fontSize: 'clamp(11px, 0.85vw, 13px)',
                      lineHeight: 1.1,
                    }}
                  >
                    <span className="relative">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </LayoutGroup>

        {/* 公告圆形按钮：直径与胶囊同宽，磨砂亚克力 + 红色描边，hover 变实心红 */}
        <motion.button
          type="button"
          onClick={openAnnouncement}
          aria-label="活动公告"
          className="relative flex items-center justify-center rounded-full border backdrop-blur-md shadow-sm font-serif tracking-[0.18em]"
          style={{
            width: 'clamp(44px, 4vw, 64px)',
            height: 'clamp(44px, 4vw, 64px)',
            borderColor: '#c23643',
            background: 'rgba(246, 241, 235, 0.55)',
            color: '#563B3B',
            fontSize: 'clamp(11px, 0.85vw, 13px)',
          }}
          whileHover={{ background: '#c23643', color: '#ffffff' }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
        >
          公告
        </motion.button>
      </div>
    </div>
  );
}

export default GlobalNav;
