'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { StoryView } from './StoryView';
import { QuillSearch } from './QuillSearch';
import { LocationPoint } from '@/lib/types';
import { useContainedMapSize } from '@/lib/hooks';
import { getPrimaryStory, getStoryAvatarUrl } from '@/lib/content';
import { useContentData } from '@/lib/content-store';
import { useAppStore } from '@/lib/store';

/**
 * InteractiveMap (交互式地图组件)
 *
 * 交互流程:
 *  idle ──(点击 Pin)──► rolling ──(地图动画完成)──► rolled
 *  rolled ──(点击卷轴)──► unrolling ──(故事退出完成 → 地图展开 → 动画完成)──► idle
 *
 * 布局策略:
 *  - 地图容器: absolute inset-0, 动画通过 translateX 移动 (向左移出视野)
 *  - 故事面板: absolute top-0 right-0 bottom-0, z-10 (位于地图下方)
 *  - 卷起后: 靠左剩余 56px 条带可见，故事面板从右侧露出
 *  - 卷轴条按钮: z-30 (位于左边界，提供展开按钮)
 *
 * 性能要点:
 *  - 使用 transform (translateX) 代替 width 动画，跳过 Layout/Paint 阶段
 *  - mapContainerRef 指向内层 100vw div，ResizeObserver 不受动画影响
 *  - 动画过渡期间节流 ResizeObserver 回调，避免无效 re-render
 *  - phaseRef 同步最新 phase，避免 animation callback 闭包陷阱
 *  - isMapRolled 与 phase 解耦，确保"故事退出 → 地图展开"的顺序动画
 */

type Phase = 'idle' | 'rolling' | 'rolled' | 'unrolling';

/** 卷轴条宽度 (px) */
const STRIP_WIDTH = 56;

/** 地图卷起及展开交互的动画参数 */
const MAP_ROLL_TRANSITION = {
  // 卷起 (即向右平移露出故事)，增加一点点弹性和更平滑的触底
  roll: { duration: 0.52, ease: [0.16, 1, 0.3, 1] as const },
  // 展开 (覆盖故事)，使用带有轻微沉淀感的曲线
  unroll: { duration: 0.52, ease: [0.32, 0.72, 0, 1] as const },
};

export function InteractiveMap() {
  const data = useContentData();
  // ─── 相位状态机 ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ─── 地图折叠状态 (与 phase 解耦，用于驱动 clipPath 动画) ────────────────
  /**
   * isMapRolled 单独控制 Framer Motion clipPath animate 值，
   * 这样可在 AnimatePresence.onExitComplete 回调中精确触发地图展开，
   * 而不是在 phase 变更时立即触发。
   */
  const [isMapRolled, setIsMapRolled] = useState(false);

  // ─── 当前激活地点 ──────────────────────────────────────────────────────────
  const [activeLocation, setActiveLocation] = useState<LocationPoint | null>(null);

  // ─── 搜索跳转相关 ─────────────────────────────────────────────────────────
  const [bouncingPinId, setBouncingPinId] = useState<string | null>(null);
  /** 搜索命中后暂存目标 locationId，等地图展开完成后执行跳动 */
  const searchTargetRef = useRef<string | null>(null);

  // ─── 开发工具：鼠标坐标追踪 ────────────────────────────────────────────────
  const showMapCoordinates = useAppStore((s) => s.showMapCoordinates);
  const mapImageRef = useRef<HTMLDivElement | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number } | null>(null);

  const handleMapMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = mapImageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMouseCoords({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }, []);

  const handleMapMouseLeave = useCallback(() => {
    setMouseCoords(null);
  }, []);

  // ─── 容器 & 地图尺寸计算 ──────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapAspect, setMapAspect] = useState<number | null>(null);

  /**
   * rollOffset: clipPath 动画的裁剪量 (像素)
   * = 容器宽度 - STRIP_WIDTH
   * 使用数值而非 calc() 字符串，保证 Framer Motion 插值可靠
  */
  const [rollOffset, setRollOffset] = useState(0);

  const handleContainerResize = useCallback(({ width }: { width: number; height: number }) => {
    setRollOffset(Math.max(0, width - STRIP_WIDTH));
  }, []);

  const shouldMeasureMap = useCallback(() => {
    return phaseRef.current !== 'rolling' && phaseRef.current !== 'unrolling';
  }, []);

  const mapSize = useContainedMapSize(mapContainerRef, mapAspect, {
    onContainerResize: handleContainerResize,
    shouldMeasure: shouldMeasureMap,
    // 展示框 border-[6px] 使用 box-content 绘制在 width/height 之外，
    // 这里为四周各预留 6px，避免 border 溢出到外层 overflow-hidden 的裁剪边界。
    insetPx: 6,
  });

  // ─── 事件处理器 ────────────────────────────────────────────────────────────

  /** 点击地图 Pin：仅在 idle 状态下响应，防止动画中途重入 */
  const handleLocationSelect = useCallback((location: LocationPoint) => {
    if (phaseRef.current !== 'idle') return;
    setActiveLocation(location);
    setIsMapRolled(true);
    setPhase('rolling');
  }, []);

  /** 点击卷轴条：仅在 rolled 状态下响应 */
  const handleRollBack = useCallback(() => {
    if (phaseRef.current !== 'rolled') return;
    setPhase('unrolling');
  }, []);

  /**
   * 故事面板退出动画完成时触发 (AnimatePresence.onExitComplete)
   * 此时才启动地图展开动画，实现"先退出故事 → 再展开地图"的顺序感。
   */
  const handleStoryExitComplete = useCallback(() => {
    setIsMapRolled(false);
  }, []);

  /**
   * 地图 clipPath 动画完成时触发。
   * 使用 phaseRef 读取最新 phase，避免闭包陷阱。
   */
  const handleMapAnimationComplete = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'rolling') {
      setPhase('rolled');
    } else if (p === 'unrolling') {
      setPhase('idle');
      setActiveLocation(null);

      // 如果是搜索跳转引起的 unrolling，展开完成后执行 Pin 跳动
      const target = searchTargetRef.current;
      if (target) {
        searchTargetRef.current = null;
        setBouncingPinId(target);
        // 跳动结束后选中该 location 并重新卷起
        setTimeout(() => {
          setBouncingPinId(null);
          const loc = data.locations.find((l) => l.id === target);
          if (loc) {
            setActiveLocation(loc as LocationPoint);
            setIsMapRolled(true);
            setPhase('rolling');
          }
        }, 900); // 跳动动画约 0.8s
      }
    }
  }, [data.locations]);

  /**
   * 搜索成功回调：先关闭故事面板，展开地图，然后跳动 Pin。
   */
  const handleSearchResult = useCallback((locationId: string) => {
    if (phaseRef.current !== 'rolled') return;
    searchTargetRef.current = locationId;
    setPhase('unrolling');
  }, []);

  // showStory 控制 AnimatePresence 的挂载/卸载
  // 仅在 'rolled' 状态（地图已完全卷起）时显示，确保顺序感
  const showStory = phase === 'rolled';

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-background">

      {/* 网格草稿线背景 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '28px 28px',
        }}
      />

      {/* ── 故事面板 ─────────────────────────────────────────────────────────
          z-10，位于地图下方。地图卷起后从右侧"露出"。
          key 绑定 activeLocation.id：切换地点时触发重新挂载与进场动画。
          onExitComplete：故事退场完成后，通知地图开始展开。
      ──────────────────────────────────────────────────────────────────── */}
      <AnimatePresence onExitComplete={handleStoryExitComplete}>
        {showStory && activeLocation && (
          <motion.div
            key={activeLocation.id}
            className="absolute top-0 right-0 bottom-0 z-10"
            style={{ left: STRIP_WIDTH }}
            initial={{ opacity: 0, y: 48 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { type: 'spring', stiffness: 58, damping: 18 },
            }}
            exit={{
              opacity: 0,
              y: '-2%',
              transition: { duration: 0.4, ease: 'easeInOut' },
            }}
          >
            <StoryView stories={activeLocation.stories} />
            {/* 笔与墨搜索组件 — 固定在故事面板右下角 */}
            <QuillSearch onSearchResult={handleSearchResult} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 地图容器 ──────────────────────────────────────────────────────────
          z-20。使用双层 translateX 实现"卷起"效果 (纯 GPU Compositor，零 repaint)。
          外层: translateX(-rollOffset) 左推 + overflow-hidden 裁剪可见区域
          内层: translateX(rollOffset) 反向右推 → 地图内容视觉保持原位
          三层均 will-change:transform → SVG 预光栅化至 GPU 纹理，动画期间零 CPU 绘制
      ──────────────────────────────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0 z-20 overflow-hidden shadow-[8px_0_30px_rgba(0,0,0,0.08)]"
        style={{ willChange: 'transform' }}
        animate={{ x: isMapRolled ? -rollOffset : 0 }}
        transition={isMapRolled ? MAP_ROLL_TRANSITION.roll : MAP_ROLL_TRANSITION.unroll}
        onAnimationComplete={handleMapAnimationComplete}
      >
        {/* 反向位移层：抵消外层 translateX，使地图视觉上保持原位 */}
        <motion.div
          className="absolute inset-0"
          style={{ willChange: 'transform' }}
          animate={{ x: isMapRolled ? rollOffset : 0 }}
          transition={isMapRolled ? MAP_ROLL_TRANSITION.roll : MAP_ROLL_TRANSITION.unroll}
        >
          {/* 地图内容层：translateZ(0) 强制 GPU 层，SVG 预光栅化为纹理
              contain: layout style paint 隔离重绘边界 */}
          <div
            ref={mapContainerRef}
            className="absolute inset-0"
            style={{
              width: '100vw',
              transform: 'translateZ(0)',
              contain: 'layout style paint',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              {/*
               * 地图展示框：围绕可见地图内容的白色实体边框。
               *   - 宽度 6px、纯白 (#FFFFFF)；搭配 object-contain 的 SVG 填充，
               *     边框紧贴地图实际可见矩形，不随容器留白扩张。
               *   - `box-content` 关键：保持 width/height 对应 mapSize.*
               *     的内容区，边框绘制在其外侧，避免内容区宽高比偏移导致
               *     `object-contain` 产生 letterbox、进而使 Pin 百分比坐标
               *     相对底图发生偏移。
               *   - 叠加柔和投影以在米色底页上与地图本体分离。
               */}
              <div
                ref={mapImageRef}
                className="relative box-content border-[6px] border-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
                style={{ width: mapSize.width, height: mapSize.height }}
                onMouseMove={showMapCoordinates ? handleMapMouseMove : undefined}
                onMouseLeave={showMapCoordinates ? handleMapMouseLeave : undefined}
              >

                {/* 地图底图 */}
                <Image
                  src="/images/map.svg"
                  alt="HNU Map"
                  fill
                  className="object-contain"
                  priority
                  sizes="100vw"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      setMapAspect(img.naturalWidth / img.naturalHeight);
                    }
                  }}
                />

                {/* 地图 Pin 点 */}
                {data.locations.map((loc) => {
                  const latestStory = getPrimaryStory(loc);

                  const isBouncing = bouncingPinId === loc.id;

                  return (
                    <motion.div
                      key={loc.id}
                      className="absolute cursor-pointer group"
                      style={{
                        left: `${loc.x}%`,
                        top: `${loc.y}%`,
                      }}
                      animate={
                        isBouncing
                          ? {
                            y: ['-50%', 'calc(-50% - 14px)', '-50%', 'calc(-50% - 10px)', '-50%'],
                            x: '-50%',
                          }
                          : { x: '-50%', y: '-50%' }
                      }
                      transition={
                        isBouncing
                          ? { duration: 0.8, ease: 'easeInOut', times: [0, 0.2, 0.45, 0.65, 1] }
                          : { duration: 0 }
                      }
                      onClick={() => handleLocationSelect(loc)}
                    >
                      {latestStory ? (
                        <div className="w-12 h-12 rounded-full border-[3px] border-white shadow-lg overflow-hidden bg-white opacity-90 hover:opacity-100 hover:scale-110 hover:-translate-y-2 transition-all duration-300 relative z-10">
                          <Image
                            src={getStoryAvatarUrl(latestStory)}
                            alt={latestStory.characterName}
                            width={48}
                            height={48}
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                      ) : (
                        <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[#cfae7a] bg-[#fff7eb] text-[#8b5a2b] shadow-lg opacity-90 transition-all duration-300 hover:-translate-y-2 hover:scale-110 hover:opacity-100">
                          <MapPin className="h-5 w-5" />
                        </div>
                      )}

                      {/* Hover Tooltip */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none z-20">
                        {loc.name}
                        {loc.stories.length > 1 && (
                          <span className="ml-1 text-xs text-gray-300">({loc.stories.length})</span>
                        )}
                        {loc.stories.length === 0 && (
                          <span className="ml-1 text-xs text-gray-300">(待补内容)</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── 开发工具：坐标显示 ──────────────────────────────────────────────
          z-40，固定在视口左下角，仅 showMapCoordinates 为 true 时渲染。
      ──────────────────────────────────────────────────────────────────── */}
      {showMapCoordinates && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-40">
          <div className="rounded bg-black/70 px-3 py-1.5 font-mono text-xs text-white">
            {mouseCoords
              ? `x: ${mouseCoords.x.toFixed(2)}  y: ${mouseCoords.y.toFixed(2)}`
              : 'x: --  y: --'}
          </div>
        </div>
      )}

      {/* ── 卷曲阴影 ──────────────────────────────────────────────────────────
          z-25，独立于地图容器。位于 clip 边缘，模拟卷起时的 3D 光影。
      ──────────────────────────────────────────────────────────────────── */}
      <motion.div
        className="absolute top-0 bottom-0 z-25 w-16 pointer-events-none"
        style={{
          left: STRIP_WIDTH,
          background: 'linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.04) 40%, transparent 100%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isMapRolled ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* ── 卷轴条 (Scroll Strip) ──────────────────────────────────────────
          z-30，独立于地图容器（不受 clipPath 影响）。
          固定在视口左侧，地图卷起时淡入。
          点击此条触发 handleRollBack，启动还原流程。
      ──────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMapRolled && (
          <motion.button
            key="scroll-strip"
            className="absolute left-0 top-0 bottom-0 z-30 flex flex-col items-center justify-center gap-4 select-none"
            style={{
              width: STRIP_WIDTH,
              background: 'linear-gradient(to left, #ede6d9 50%, rgba(237,230,217,0.6))',
              boxShadow: '-5px 0 25px rgba(139,90,43,0.22), inset 2px 0 0 rgba(139,90,43,0.15)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22, delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            onClick={handleRollBack}
            aria-label="展开地图"
            title="点击展开地图"
          >
            {/* 装饰性横纹（模拟卷纸边缘） */}
            <div
              className="absolute inset-y-10 left-3 right-3 flex flex-col justify-between pointer-events-none"
              aria-hidden="true"
            >
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="h-px rounded-full" style={{ background: 'rgba(120,70,20,0.15)' }} />
              ))}
            </div>

            {/* 地图 Pin 图标 */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="relative z-10 flex-shrink-0"
              style={{ color: 'rgba(139,90,43,0.7)' }}
              aria-hidden="true"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>

            {/* 竖排文字 */}
            <p
              className="relative z-10 text-[10px] tracking-[0.28em] font-medium"
              style={{ writingMode: 'vertical-rl', color: 'rgba(120,70,20,0.65)' }}
            >
              展开地图
            </p>

            {/* 向右箭头（暗示可展开） */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="relative z-10 flex-shrink-0"
              style={{ color: 'rgba(139,90,43,0.6)' }}
              aria-hidden="true"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
