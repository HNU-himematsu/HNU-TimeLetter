'use client';

import { motion, useMotionValue, useTransform, PanInfo, animate, MotionValue, useMotionValueEvent, MotionStyle } from 'framer-motion';
import NextImage from 'next/image';
import { Story } from '@/lib/types';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { getStoryMainImageUrl } from '@/lib/content';

interface StoryCardStackProps {
    stories: Story[];
    activeIndices: number[]; // 当前卡片堆叠顺序 (索引数组)
    onSwipe: () => void;     // 触发“滑动”事件 (切换下一张)
    onSelect: () => void;    // 触发“点击”事件 (查看/隐藏详情)
}

export function StoryCardStack({ stories, activeIndices, onSwipe, onSelect }: StoryCardStackProps) {
    const normalizedIndices = useMemo(
        () => activeIndices.filter((index) => index >= 0 && index < stories.length),
        [activeIndices, stories.length]
    );
    const renderIndices = useMemo(
        () => (normalizedIndices.length > 0 ? normalizedIndices : stories.map((_, i) => i)),
        [normalizedIndices, stories]
    );
    const reversedIndices = useMemo(() => renderIndices.slice().reverse(), [renderIndices]);
    const topIndex = renderIndices[0];

    // 共享的拖拽值，仅用于驱动"下一张"卡片的联动动画 (Scale/Opacity)
    // 实际的卡片位移由各卡片内部的 MotionValue (x) 独立管理
    const sharedDragX = useMotionValue(0);

    // 处理滑动完成的逻辑
    const handleSwipeComplete = useCallback(() => {
        onSwipe();
        // 重置联动值，以便下一张卡片（新的 Top）处于初始状态
        sharedDragX.set(0);
    }, [onSwipe, sharedDragX]);

    // 预加载故事图片，减少切换到下一张时的解码卡顿
    useEffect(() => {
        stories.forEach((story) => {
            const img = new window.Image();
            img.src = getStoryMainImageUrl(story);
        });
    }, [stories]);

    return (
        <div className="relative w-full h-[60vh] flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center">
                {reversedIndices.map((index, i) => {
                    const isTop = index === topIndex;
                    const story = stories[index];
                    if (!story) return null;

                    const offset = renderIndices.length - 1 - i; // 0 = 顶层, 1 = 第二层...

                    return (
                        <Card
                            key={story.id}
                            story={story}
                            isTop={isTop}
                            offset={offset}
                            storyCount={stories.length}
                            sharedDragX={sharedDragX}
                            zIndex={renderIndices.length - offset}
                            onSwipe={handleSwipeComplete}
                            onSelect={onSelect}
                        />
                    );
                })}
            </div>

            <motion.div 
                className="absolute -bottom-8 pointer-events-none text-stone-500/60 text-xs tracking-widest font-serif flex items-center justify-center gap-3 transition-opacity duration-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
            >
                {stories.length > 1 && (
                    <>
                        <span className="flex items-center gap-1">
                            <span className="text-[10px] opacity-70">◀</span>
                            左右拖拽切换
                            <span className="text-[10px] opacity-70">▶</span>
                        </span>
                        <span className="w-1 h-1 rounded-full bg-stone-300"></span>
                    </>
                )}
                <span>点击查看详情</span>
            </motion.div>
        </div>
    );
}

interface CardProps {
    story: Story;
    isTop: boolean;
    offset: number;
    storyCount: number;
    sharedDragX: MotionValue<number>;
    zIndex: number;
    onSwipe: () => void;
    onSelect: () => void;
}

function CardComponent({ story, isTop, offset, storyCount, sharedDragX, zIndex, onSwipe, onSelect }: CardProps) {
    // 每个卡片拥有独立的 x 位移状态
    const x = useMotionValue(0);

    // 只有顶层卡片负责更新共享的 dragX，从而驱动底层卡片的联动
    useMotionValueEvent(x, "change", (latest) => {
        if (isTop) {
            sharedDragX.set(latest);
        }
    });

    // 监听 isTop 变化，实现“回归动画”
    // 当卡片从 Top 变为非 Top (被划走) 时，它此刻的位置在屏幕外 (fly out distance)
    // 我们需要将它从屏幕外平滑移动回 x=0，实现“从同方向插入底部”的效果
    useEffect(() => {
        if (!isTop && x.get() !== 0) {
            // damping 值使卡片在飞出后补位时呈现物理沉降感
            animate(x, 0, { type: "spring", stiffness: 280, damping: 28 });
        }
    }, [isTop, x]);

    // 基础样式计算
    const isTwoCards = storyCount === 2;
    const scaleFactor = isTwoCards ? 0.02 : 0.05;

    const baseScale = 1 - offset * scaleFactor;
    const baseY = offset * 18;  // 将基础间距稍微加大，凸显堆叠层次
    const baseRotate = offset * 2.5; // 旋转角度略微收敛
    // 目标状态 (下一层级，即 offset - 1)
    const targetOffset = Math.max(0, offset - 1);
    const targetScale = 1 - targetOffset * scaleFactor;
    const targetY = targetOffset * 18;
    const targetRotate = targetOffset * 2.5;

    // --- 联动动画逻辑 ---
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const inputRange = [-screenWidth, 0, screenWidth];

    const animatedScale = useTransform(sharedDragX, inputRange, [targetScale, baseScale, targetScale]);
    const animatedY = useTransform(sharedDragX, inputRange, [targetY, baseY, targetY]);
    const animatedRotate = useTransform(sharedDragX, inputRange, [targetRotate, baseRotate, targetRotate]);

    // 只有顶层卡片跟随旋转，底层卡片保持静态或微动
    const topRotate = useTransform(x, [-200, 200], [-10, 10]);

    // 最终样式组装
    let style: MotionStyle = {
        x: x, // 始终绑定内部 x
        zIndex
    };

    if (isTop) {
        // 顶层卡片: 全尺寸，不透明，旋转跟随拖拽
        style = { ...style, scale: 1, opacity: 1, y: 0, rotate: topRotate };
    } else {
        // 所有底层卡片: 响应 sharedDragX 实现联动放大/上浮/透明度变化
        style = {
            ...style,
            scale: animatedScale,
            opacity: 1,
            y: animatedY,
            rotate: animatedRotate
        };
    }

    // 拖拽结束处理
    const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const offsetVal = info.offset.x;
        const velocity = info.velocity.x;

        // 降低飞出判定阈值，响应更加灵敏 (原100->80, 原500->400)
        if ((Math.abs(offsetVal) > 80 || Math.abs(velocity) > 400) && storyCount > 1) {
            const direction = offsetVal > 0 ? 1 : -1;
            // 播放飞出动画
            await new Promise<void>(resolve => {
                animate(x, direction * screenWidth, {
                    duration: 0.25, // 稍微加快飞出速度
                    ease: "circOut", // 更改缓动函数，初速度更快
                    onComplete: () => resolve()
                });
            });
            onSwipe();
        } else {
            // 回弹，增强重量感与物理反馈 (stiffness 降低，damping 增大)
            animate(x, 0, { type: "spring", stiffness: 240, damping: 25 });
        }
    };

    return (
        <motion.div
            className="absolute h-[60vh] max-h-[600px] w-auto bg-white rounded-md shadow-2xl cursor-pointer border-[8px] border-white flex-shrink-0 will-change-transform"
            style={style}
            drag={isTop ? "x" : false}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.25} // 增大 dragElastic 允许更明显的橡皮筋反馈拉扯感
            onDragEnd={handleDragEnd}
            onClick={(e) => {
                e.stopPropagation();
                if (isTop && Math.abs(x.get()) < 10) onSelect();
            }}
            whileHover={isTop ? { scale: 1.02 } : {}}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
            <div className="relative h-full w-auto">
                <NextImage
                    src={getStoryMainImageUrl(story)}
                    alt={story.characterName}
                    width={420}
                    height={600}
                    className="h-full w-auto object-cover rounded-sm pointer-events-none select-none block"
                    draggable={false}
                    sizes="40vw"
                />

            </div>
        </motion.div>
    );
}

const Card = memo(CardComponent);
