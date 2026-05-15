'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useContentData } from '@/lib/content-store';

/**
 * QuillSearch (羽毛笔搜索组件)
 *
 * 状态机: idle → letter → writing → burning → idle
 *
 * - idle:    右下角显示笔墨贴图
 * - letter:  信纸从顶部飘落至屏幕中央 + 全屏灰色遮罩 + 笔墨放大
 * - writing: 笔平移书写动画 (0.5s)
 * - burning: 信纸焚毁特效 (1.2s)，完成后回调跳转或退回 idle
 */

type SearchPhase = 'idle' | 'letter' | 'writing' | 'burning';

interface QuillSearchProps {
    onSearchResult: (locationId: string) => void;
}

/** 从数据中提取所有角色名及其 locationId */
function buildCharacterIndex(data: ReturnType<typeof useContentData>): { name: string; locationId: string }[] {
    const seen = new Set<string>();
    const result: { name: string; locationId: string }[] = [];
    for (const loc of data.locations) {
        for (const story of loc.stories) {
            const key = `${story.characterName}@${loc.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push({ name: story.characterName, locationId: loc.id });
            }
        }
    }
    return result;
}

/** 预先根据随机种子生成每条射线的随机速度（用于360个方向的不规则扩散） */
function generateRayVelocities(seed: number, count: number) {
    let x = seed || 1;
    const rng = () => {
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
    };
    const NUM_RAYS = 360;
    const velocities: { angle: number; velocity: number }[][] = [];

    for (let i = 0; i < count; i++) {
        const rawV: number[] = [];
        for (let j = 0; j < NUM_RAYS; j++) {
            rawV.push(rng());
        }
        const smoothV = [];
        const WINDOW = 25; // 平滑窗口，控制突触宽度
        for (let j = 0; j < NUM_RAYS; j++) {
            let sum = 0;
            for (let w = -WINDOW; w <= WINDOW; w++) {
                const idx = (j + w + NUM_RAYS) % NUM_RAYS;
                sum += rawV[idx];
            }
            const avg = sum / (WINDOW * 2 + 1);
            // 加入少量高频噪声模拟火焰边缘的撕裂感
            const noise = rng() * 0.15 - 0.075;
            // 控制扩散速度：基于信纸尺寸（420x350），缓慢柔和的焚烧覆盖
            const v = 80 + (avg + noise) * 160;
            smoothV.push({ angle: (j * Math.PI) / 180, velocity: v });
        }
        velocities.push(smoothV);
    }
    return velocities;
}

/* ── 灰烬粒子配置 ─────────────────────────────────────────────── */
const ASH_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 360 - 180,
    delay: Math.random() * 0.6,
    size: 3 + Math.random() * 5,
    duration: 0.8 + Math.random() * 0.6,
}));

export function QuillSearch({ onSearchResult }: QuillSearchProps) {
    const data = useContentData();
    const [phase, setPhase] = useState<SearchPhase>('idle');
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [foundLocationId, setFoundLocationId] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [burnSeed, setBurnSeed] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const characterIndex = useMemo(() => buildCharacterIndex(data), [data]);

    // 确保 Portal 仅在客户端挂载后使用
    useEffect(() => setMounted(true), []);

    // 焚毁扩散原点（4个点）
    const originPoints = useMemo(() => {
        if (!burnSeed) return [];
        const random = (s: number) => {
            const x = Math.sin(s) * 10000;
            return x - Math.floor(x);
        };
        return [
            { x: 50 + random(burnSeed) * 320, y: 50 + random(burnSeed + 1) * 200 },
            { x: 50 + random(burnSeed + 2) * 320, y: 50 + random(burnSeed + 3) * 200 },
            { x: 50 + random(burnSeed + 4) * 320, y: 50 + random(burnSeed + 5) * 200 },
            { x: 50 + random(burnSeed + 6) * 320, y: 50 + random(burnSeed + 7) * 200 }
        ];
    }, [burnSeed]);

    // 根据时间戳生成的伪随机 360 度多边形扩散速度
    const rayVelocities = useMemo(() => {
        if (!burnSeed) return [];
        return generateRayVelocities(burnSeed, originPoints.length);
    }, [burnSeed, originPoints.length]);

    // 使用 requestAnimationFrame 实时计算焚烧路径以支持 360 顶点和复杂连通边缘
    useEffect(() => {
        if (phase !== 'burning' || originPoints.length === 0 || rayVelocities.length === 0) return;

        const startTime = performance.now();
        let animationFrameId: number;

        const animate = (time: number) => {
            let elapsed = (time - startTime) / 1000; // 秒
            if (elapsed > 1.2) elapsed = 1.2;

            for (let i = 0; i < originPoints.length; i++) {
                const cx = originPoints[i].x;
                const cy = originPoints[i].y;
                const rays = rayVelocities[i];
                let d = "";

                for (let j = 0; j < 360; j++) {
                    const { angle, velocity } = rays[j];
                    const r = velocity * elapsed;
                    const x = cx + r * Math.cos(angle);
                    const y = cy + r * Math.sin(angle);

                    if (j === 0) d += `M ${x.toFixed(1)} ${y.toFixed(1)} `;
                    else d += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
                }
                d += "Z";

                const pathEl = document.getElementById(`burn-path-${i}`);
                if (pathEl) pathEl.setAttribute('d', d);
            }

            if (elapsed < 1.2) {
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [phase, originPoints, rayVelocities]);

    // 模糊过滤建议
    const suggestions = useMemo(() => {
        if (!inputValue.trim()) return [];
        return characterIndex.filter((c) =>
            c.name.toLowerCase().includes(inputValue.trim().toLowerCase())
        );
    }, [inputValue, characterIndex]);

    // 点击贴图 → 展开信纸
    const handleQuillClick = useCallback(() => {
        if (phase !== 'idle') return;
        setPhase('letter');
        setInputValue('');
        setNotFound(false);
        setFoundLocationId(null);
    }, [phase]);

    // 聚焦输入框（信纸飘落后延迟聚焦）
    useEffect(() => {
        if (phase === 'letter') {
            const timer = setTimeout(() => inputRef.current?.focus(), 800);
            return () => clearTimeout(timer);
        }
    }, [phase]);

    // 提交搜索
    const handleSubmit = useCallback((overrideName?: string) => {
        const finalName = typeof overrideName === 'string' ? overrideName : inputValue;
        const query = finalName.trim();
        if (!query || phase !== 'letter') return;

        if (submitTimerRef.current) {
            clearTimeout(submitTimerRef.current);
        }
        setShowSuggestions(false);
        if (typeof overrideName === 'string') {
            setInputValue(overrideName);
        }
        setPhase('writing');

        // 0.5s 书写动画后进入 burning
        submitTimerRef.current = setTimeout(() => {
            submitTimerRef.current = null;
            const match = characterIndex.find((c) =>
                c.name.toLowerCase().includes(query.toLowerCase())
            );
            if (match) {
                setFoundLocationId(match.locationId);
                setNotFound(false);
            } else {
                setFoundLocationId(null);
                setNotFound(true);
            }
            setBurnSeed(Date.now());
            setPhase('burning');
        }, 500);
    }, [inputValue, phase, characterIndex]);

    useEffect(() => {
        return () => {
            if (submitTimerRef.current) {
                clearTimeout(submitTimerRef.current);
            }
        };
    }, []);

    // burning 阶段 — 焚毁动画结束后执行回调或退回 idle
    useEffect(() => {
        if (phase === 'burning') {
            const timer = setTimeout(() => {
                if (foundLocationId) {
                    onSearchResult(foundLocationId);
                }
                setPhase('idle');
                setInputValue('');
                setFoundLocationId(null);
                setNotFound(false);
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [phase, foundLocationId, notFound, onSearchResult]);

    // 选中建议，直接提交
    const handleSelectSuggestion = useCallback((name: string) => {
        handleSubmit(name);
    }, [handleSubmit]);

    // 点击遮罩或墨水瓶 → 回到 idle
    const handleDismiss = useCallback(() => {
        if (phase === 'burning') return; // 焚毁中不允许关闭
        if (submitTimerRef.current) {
            clearTimeout(submitTimerRef.current);
            submitTimerRef.current = null;
        }
        setPhase('idle');
        setInputValue('');
        setNotFound(false);
        setFoundLocationId(null);
    }, [phase]);

    const isOpen = phase !== 'idle';

    /* ── 全屏模态（Portal 渲染到 body） ────────────────────────── */
    const renderOverlay = () => {
        if (!mounted) return null;

        return createPortal(
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="quill-overlay"
                        className="fixed inset-0 z-[9999] flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* 灰色遮罩背景 */}
                        <motion.div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={handleDismiss}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />

                        {/* ── 信纸（从顶部飘落） ──────────────────────── */}
                        <motion.div
                            className="relative z-10"
                            initial={{ y: '-100dvh', rotate: -8, opacity: 0 }}
                            animate={
                                phase === 'burning'
                                    ? { y: 0, rotate: 0, opacity: 1 }
                                    : { y: 0, rotate: 0, opacity: 1 }
                            }
                            exit={{ y: '-30vh', rotate: -5, opacity: 0 }}
                            transition={{
                                type: 'spring',
                                stiffness: 60,
                                damping: 14,
                                mass: 0.8,
                            }}
                        >
                            {/* 纯正完整的 SVG 高级着色滤镜与动态 360 点多边形掩码池 */}
                            {isOpen && (
                                <svg width="0" height="0" style={{ position: 'absolute' }}>
                                    <defs>
                                        <filter id="burn-edge-filter" x="-20%" y="-20%" width="140%" height="140%">
                                            {/* 提取多边形透明度 */}
                                            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="alpha" />

                                            {/* 以轻微高斯模糊柔化几何刺角边缘，使火焰连通更自然 */}
                                            <feGaussianBlur in="alpha" stdDeviation="3" result="soft_alpha" />

                                            {/* 极低频噪点大尺度扰动，产生云雾状的自然火熏弥散感 */}
                                            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" result="noise" />
                                            <feDisplacementMap in="soft_alpha" in2="noise" scale="25" xChannelSelector="R" yChannelSelector="G" result="displaced_alpha" />

                                            {/* 形态膨胀再模糊产生宽阔厚重的外部焦烟圆环 */}
                                            <feMorphology in="displaced_alpha" operator="dilate" radius="10" result="char_outer_raw" />
                                            <feGaussianBlur in="char_outer_raw" stdDeviation="6" result="char_outer" />

                                            {/* 形态膨胀再模糊产生收拢一点的内部炽火圆环 */}
                                            <feMorphology in="displaced_alpha" operator="dilate" radius="4" result="fire_outer_raw" />
                                            <feGaussianBlur in="fire_outer_raw" stdDeviation="2" result="fire_outer" />

                                            {/* 掏除透明核心区域，只截取外缘带 */}
                                            <feComposite in="char_outer" in2="displaced_alpha" operator="out" result="char_ring" />
                                            <feComposite in="fire_outer" in2="displaced_alpha" operator="out" result="fire_ring" />

                                            {/* 将极黑褐色的碳灰映射到焦黑环上 */}
                                            <feFlood floodColor="#1a0a03" floodOpacity="0.85" result="char_color" />
                                            <feComposite in="char_color" in2="char_ring" operator="in" result="char_layer" />

                                            {/* 将高亮的橙红赤火映射到火圈环上 */}
                                            <feFlood floodColor="#ff4500" floodOpacity="0.95" result="fire_color" />
                                            <feComposite in="fire_color" in2="fire_ring" operator="in" result="fire_layer" />

                                            {/* 发光合成 */}
                                            <feMerge>
                                                <feMergeNode in="char_layer" />
                                                <feMergeNode in="fire_layer" />
                                            </feMerge>
                                        </filter>

                                        {/* 渲染并连通 4 个源点的 360 度动态向外扩散边界 */}
                                        <g id="burn-shapes">
                                            {originPoints.map((_, i) => (
                                                <path key={`path-${i}`} id={`burn-path-${i}`} d="" />
                                            ))}
                                        </g>

                                        {/* 用于信纸扣除内部展现透明遮罩的 Mask */}
                                        <mask id="burn-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
                                            <rect width="500" height="500" fill="white" />
                                            <use href="#burn-shapes" fill="black" />
                                        </mask>
                                    </defs>
                                </svg>
                            )}

                            <motion.div
                                animate={
                                    phase === 'burning'
                                        ? { opacity: [1, 1, 1, 0] }
                                        : {}
                                }
                                transition={{
                                    duration: 1.2,
                                    ease: 'linear',
                                    times: [0, 0.8, 0.98, 1]
                                }}
                                style={
                                    phase === 'burning'
                                        ? {
                                            WebkitMask: 'url(#burn-mask)',
                                            mask: 'url(#burn-mask)',
                                            maskType: 'alpha', // Firefox support
                                        }
                                        : {}
                                }
                            >
                                <div
                                    className="relative bg-[#fdfbf3] rounded-md shadow-2xl border border-[#e8dcc8] overflow-hidden"
                                    style={{ width: 420 }}
                                >
                                    {/* 独立的边缘滤镜渲染层：放在带 overflow-hidden 的主体容器内部，严格截断边界！ */}
                                    <AnimatePresence>
                                        {phase === 'burning' && (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-hidden">
                                                <use href="#burn-shapes" fill="white" filter="url(#burn-edge-filter)" />
                                            </svg>
                                        )}
                                    </AnimatePresence>

                                    {/* 信纸内容 */}
                                    <div className="px-8 pt-8 pb-6">
                                        {/* 标题 */}
                                        <p
                                            className="text-center text-sm text-[#8b5a2b] mb-6 tracking-widest"
                                            style={{ fontFamily: "'Noto Serif SC', serif" }}
                                        >
                                            你想要寻找的「她」是？
                                        </p>

                                        {/* 四条横线 + 输入框 */}
                                        <div className="relative">
                                            {[0, 1, 2, 3].map((i) => (
                                                <div
                                                    key={i}
                                                    className="w-full h-px bg-[#292524] opacity-25"
                                                    style={{ marginBottom: i < 3 ? 32 : 0 }}
                                                />
                                            ))}

                                            {/* 输入框 */}
                                            <div className="absolute left-0 right-0" style={{ top: 6 }}>
                                                <input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={inputValue}
                                                    onChange={(e) => {
                                                        setInputValue(e.target.value);
                                                        setShowSuggestions(true);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSubmit();
                                                    }}
                                                    onFocus={() => setShowSuggestions(true)}
                                                    placeholder="请输入角色名..."
                                                    className="w-full bg-transparent border-none outline-none text-[#292524] text-base tracking-wide placeholder:text-[#b8a898]"
                                                    style={{
                                                        fontFamily: "'Noto Serif SC', serif",
                                                        caretColor: '#8b5a2b',
                                                    }}
                                                    disabled={phase !== 'letter'}
                                                />

                                                {/* 下拉建议 */}
                                                <AnimatePresence>
                                                    {showSuggestions && suggestions.length > 0 && phase === 'letter' && (
                                                        <motion.ul
                                                            initial={{ opacity: 0, y: -4 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -4 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="absolute left-0 right-0 top-8 bg-white/95 backdrop-blur-sm border border-[#e8dcc8] rounded shadow-lg z-50 max-h-32 overflow-y-auto"
                                                        >
                                                            {suggestions.map((s, i) => (
                                                                <li
                                                                    key={`${s.name}-${s.locationId}-${i}`}
                                                                    className="px-3 py-2 text-sm text-[#292524] hover:bg-[#f5efe5] cursor-pointer transition-colors"
                                                                    style={{ fontFamily: "'Noto Serif SC', serif" }}
                                                                    onClick={() => handleSelectSuggestion(s.name)}
                                                                >
                                                                    {s.name}
                                                                </li>
                                                            ))}
                                                        </motion.ul>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>

                                        {/* 书写动画指示 */}
                                        <AnimatePresence>
                                            {phase === 'writing' && (
                                                <motion.div
                                                    className="mt-5 text-center text-xs text-[#8b5a2b] italic"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: [0, 1, 0.5, 1] }}
                                                    transition={{ duration: 0.5, repeat: 0 }}
                                                >
                                                    正在书写「魔法书」中
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* 未找到结果提示 */}
                                        <AnimatePresence>
                                            {phase === 'burning' && notFound && (
                                                <div className="mt-4">
                                                    <motion.p
                                                        className="text-center text-sm text-[#8b5a2b] tracking-wide"
                                                        style={{ fontFamily: "'Noto Serif SC', serif" }}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                    >
                                                        您所寻找的「她」似乎并未来到这里
                                                    </motion.p>
                                                    <motion.p
                                                        className="text-center text-sm text-[#a0896e] mt-2 tracking-wide"
                                                        style={{ fontFamily: "'Noto Serif SC', serif" }}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.3, delay: 0.3 }}
                                                    >
                                                        敬请期待以后的邂逅
                                                    </motion.p>
                                                </div>
                                            )}
                                        </AnimatePresence>

                                        {/* 找到结果 */}
                                        <AnimatePresence>
                                            {phase === 'burning' && foundLocationId && (
                                                <motion.p
                                                    className="mt-4 text-center text-sm text-[#4a8b5a] tracking-wide"
                                                    style={{ fontFamily: "'Noto Serif SC', serif" }}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    寻迹而去...
                                                </motion.p>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </motion.div>

                            {/* ── 灰烬粒子（仅 burning 阶段） ────────── */}
                            <AnimatePresence>
                                {phase === 'burning' && (
                                    <>
                                        {ASH_PARTICLES.map((p) => (
                                            <motion.div
                                                key={`ash-${p.id}`}
                                                className="absolute rounded-full"
                                                style={{
                                                    width: p.size,
                                                    height: p.size,
                                                    left: '50%',
                                                    bottom: 0,
                                                    background: `hsl(${20 + Math.random() * 20}, ${60 + Math.random() * 30}%, ${30 + Math.random() * 25}%)`,
                                                }}
                                                initial={{
                                                    opacity: 0,
                                                    x: 0,
                                                    y: 0,
                                                    scale: 1,
                                                }}
                                                animate={{
                                                    opacity: [0, 0.8, 0.6, 0],
                                                    x: p.x,
                                                    y: [0, -80, -160, -240],
                                                    scale: [1, 0.8, 0.5, 0.2],
                                                }}
                                                transition={{
                                                    duration: p.duration,
                                                    delay: p.delay,
                                                    ease: 'easeOut',
                                                }}
                                            />
                                        ))}
                                    </>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* ── 放大的笔（信纸右侧） ───────────────────── */}
                        <motion.div
                            className="fixed z-20"
                            style={{ width: 144, height: 252 }}
                            initial={{ opacity: 0, scale: 0.5, x: 100, y: 100 }}
                            animate={
                                phase === 'writing'
                                    ? {
                                        opacity: 1,
                                        scale: 1,
                                        x: [-120, -80, -40, 0, 40, 80, 100, 120],
                                        y: [-60, -75, -60, -75, -60, -75, -60, 50],
                                        rotate: [5, 0, 10, 0, 10, 0, 10, 5],
                                    }
                                    : phase === 'burning'
                                        ? { opacity: 0, scale: 0.3, x: 200, y: -100 }
                                        : { opacity: 1, scale: 1, x: 260, y: 20, rotate: 8 }
                            }
                            transition={
                                phase === 'writing'
                                    ? { duration: 0.5, ease: 'easeInOut' }
                                    : phase === 'burning'
                                        ? { duration: 0.6, ease: 'easeIn' }
                                        : { type: 'spring', stiffness: 150, damping: 15, delay: 0.1 }
                            }
                        >
                            <div className="relative w-full h-full drop-shadow-lg">
                                <Image
                                    src="/images/pen.png"
                                    alt="羽毛笔"
                                    fill
                                    className="object-contain"
                                    sizes="144px"
                                    unoptimized
                                />
                            </div>
                        </motion.div>

                        {/* ── 放大的墨水瓶（信纸右下角） ─────────────── */}
                        <motion.button
                            className="fixed z-20 cursor-pointer hover:scale-105 transition-transform"
                            style={{ width: 120, height: 120 }}
                            onClick={handleDismiss}
                            initial={{ opacity: 0, scale: 0.5, x: 100, y: 200 }}
                            animate={
                                phase === 'burning'
                                    ? { opacity: 0, scale: 0.3, x: 200, y: 200 }
                                    : { opacity: 1, scale: 1, x: 260, y: 160, rotate: 0 }
                            }
                            transition={
                                phase === 'burning'
                                    ? { duration: 0.6, ease: 'easeIn' }
                                    : { type: 'spring', stiffness: 150, damping: 15, delay: 0.15 }
                            }
                            aria-label="收起搜索"
                            title="点击收起搜索"
                        >
                            <div className="relative w-full h-full drop-shadow-lg">
                                <Image
                                    src="/images/ink.png"
                                    alt="墨水瓶"
                                    fill
                                    className="object-contain"
                                    sizes="120px"
                                    unoptimized
                                />
                            </div>
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body
        );
    };

    return (
        <>
            {/* ── 笔墨贴图 (idle 状态，原位不变) ─────────────────── */}
            <div
                className="absolute bottom-6 right-6 z-40 select-none"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => e.stopPropagation()}
            >
                <AnimatePresence>
                    {phase === 'idle' && (
                        <motion.button
                            key="quill-idle"
                            className="relative cursor-pointer hover:scale-110 transition-transform duration-300 flex items-end justify-center"
                            style={{ width: 180, height: 180 }}
                            onClick={handleQuillClick}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.3 }}
                            aria-label="搜索角色"
                            title="点击搜索角色"
                        >
                            {/* 笔 */}
                            <div className="absolute top-0 right-6 w-24 h-40 transform rotate-12 origin-bottom">
                                <Image
                                    src="/images/pen.png"
                                    alt="羽毛笔"
                                    fill
                                    className="object-contain drop-shadow-md"
                                    sizes="96px"
                                    unoptimized
                                />
                            </div>
                            {/* 墨水瓶 */}
                            <div className="absolute bottom-0 left-4 w-24 h-24">
                                <Image
                                    src="/images/ink.png"
                                    alt="墨水瓶"
                                    fill
                                    className="object-contain drop-shadow-lg"
                                    sizes="96px"
                                    unoptimized
                                />
                            </div>
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* ── 全屏搜索模态（Portal） ──────────────────────────── */}
            {renderOverlay()}
        </>
    );
}
