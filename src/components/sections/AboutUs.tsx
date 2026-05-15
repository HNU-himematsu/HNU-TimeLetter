'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

/**
 * 关于我们 (About Us)
 *
 * 左侧文案区 + 右侧成员竖排切换列表（Vertical Member Ticker）。
 *
 * 右侧列表：
 *   - 各成员条目沿垂直方向排列，头像 + 昵称靠右对齐。
 *   - 激活项居中显示，头像放大（6rem）且带红色描边；其余项缩小（4rem）并降透明度。
 *   - 每 2.5s 自动向下步进一格，触达末尾后循环回首位。
 *   - translateY 由 Spring 缓动驱动，悬停暂停，点击跳转并重置计时器。
 *   - 上下边缘使用 Background 色（#ece9e4）渐隐遮罩。
 *   - ITEM_H 随视口宽度响应：桌面端 160px，移动端 100px。
 *
 * 引导线穿越关系：P4(107.5%, 40.43%) → P5(-2.19%, 65.40%) 对角线由右上
 * 到左下贯穿本页；左侧文案（x ∈ [5%, 35%]·vw）与引导线在本页中段
 * （x ≈ 54%·vw）之间保留安全间距，自然避让。
 */

interface TeamMember {
  name: string;
  role: string;
  description: string;
  avatar?: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Aki_BG7ZGA', role: '总统筹 / AIGC 合成', description: '统筹企划全局建设与网站工程规划，负责前端设计稿与动效的落地实现，以及核心 AIGC 人物生成与光影合成。', avatar: '/images/avatars/Aki_BG7ZGA.jpg' },
  { name: '魔炮「Final Spark」', role: '后端开发', description: '负责飞书数据同步系统的架构设计与实现，建立数据结构，打通内容管理与前端展示的数据链路。', avatar: '/images/avatars/魔炮「Final Spark」.jpg' },
  { name: '折木兑太郎', role: '前端开发', description: '负责移动端适配与页面制作，确保网站在不同设备上均能呈现一致的浏览体验。', avatar: '/images/avatars/折木兑太郎.jpg' },
  { name: 'Larter', role: '艺术指导 / 视觉设计', description: '主导企划整体视觉风格与艺术定调，负责 Logo、海报及网站 UI 界面设计，为项目确立日系高级感的审美基准。', avatar: '/images/avatars/Larter.jpg' },
  { name: '不可思议の逆天酱喵', role: '文案 / 宣发', description: '负责撰写公告文案与问卷文案，以文字将企划的理念与进展传达给社群，让每一次发声都兼具温度与质感。', avatar: '/images/avatars/不可思议の逆天酱喵.jpg' },
  { name: '桜小路ルナ', role: '文案 / 策划', description: '负责收集校园地点提案，梳理群友创意，将零散的灵感整理为可执行的视觉化素材基础。', avatar: '/images/avatars/桜小路ルナ.jpg' },
  { name: '不是第二深情（青木gachi版）', role: '摄影', description: '深入海大校园取景，以镜头捕捉真实建筑的光线与空间感，为 AIGC 合成提供高质量背景素材。', avatar: '/images/avatars/不是第二深情（青木gachi版）.jpg' },
];

const ABOUT_US_PANEL_GAP = '0.75rem';
const ABOUT_US_PANEL_WIDTH = 'calc(28vw + 17rem)';

// 可视窗口内显示的条目数
const VISIBLE_COUNT = 5;
// 激活项固定在第 4 格（0-indexed: 3）
const ACTIVE_SLOT = 3;
// 无限滚动：渲染 3 倍列表，rawOffset 在中间副本循环，越界时无动画瞬移
const REPEAT_COUNT = 3;
const INFINITE_ITEMS = Array.from({ length: REPEAT_COUNT }, () => TEAM_MEMBERS).flat();

export function AboutUs() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-20%' });

  // rawOffset：INFINITE_ITEMS 中当前激活的索引，初始指向中间副本首项
  const [rawOffset, setRawOffset] = useState(TEAM_MEMBERS.length);
  // 越界瞬移时禁用弹性动画
  const [skipTransition, setSkipTransition] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [itemH, setItemH] = useState(160);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setItemH(mobile ? 100 : 160);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 越界检测：超出第三副本范围时无动画瞬移回中间副本对应位置
  useEffect(() => {
    if (rawOffset >= TEAM_MEMBERS.length * 2) {
      setSkipTransition(true);
      setRawOffset(r => r - TEAM_MEMBERS.length);
    } else if (rawOffset < TEAM_MEMBERS.length) {
      setSkipTransition(true);
      setRawOffset(r => r + TEAM_MEMBERS.length);
    }
  }, [rawOffset]);

  useEffect(() => {
    if (!skipTransition) return;
    const id = requestAnimationFrame(() => setSkipTransition(false));
    return () => cancelAnimationFrame(id);
  }, [skipTransition]);

  // 每 2.5s 向下步进一格
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setRawOffset(prev => prev + 1);
    }, 2500);
    return () => clearInterval(timer);
  }, [isHovered, timerKey]);

  const handleClick = (globalIdx: number) => {
    setRawOffset(globalIdx);
    setTimerKey(k => k + 1);
  };

  const currentMemberIndex = rawOffset % TEAM_MEMBERS.length;
  const translateY = (ACTIVE_SLOT - rawOffset) * itemH;
  const descriptionWidth = isMobile
    ? `calc((100% - ${ABOUT_US_PANEL_GAP}) * 0.44)`
    : `calc((100% - ${ABOUT_US_PANEL_GAP}) * 0.5)`;
  const tickerWidth = isMobile
    ? `calc((100% - ${ABOUT_US_PANEL_GAP}) * 0.56)`
    : `calc((100% - ${ABOUT_US_PANEL_GAP}) * 0.5)`;

  return (
    <section ref={sectionRef} className="relative w-full min-h-dvh overflow-hidden">
      <motion.div
        className="relative z-10 w-full min-h-dvh flex items-center"
        initial={{ opacity: 0, y: 60 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* 左：固定简介 */}
        <div className="absolute left-[5%] top-[5%] md:top-[14%] max-w-[44%] md:max-w-[30%] text-left">
          <h2 className="font-serif text-ink-strong tracking-[0.02em] mb-8">
            关于我们
          </h2>
          <p className="text-intro font-sans text-ink mb-0">
            「海带视研」为本企划的策展与运营团队。主要负责收集与梳理各项提案，协调摄影及后期制作，将抽象的文字构想转化为具体的视觉展品。
          </p>
        </div>

        {/* 右侧整体块：absolute 锚定于右侧，垂直居中。
            描述列与 ticker 列并排，描述文字在列内精确定槽，不受外部 flex 干扰。*/}
        <div
          style={{
            position: 'absolute',
            right: '6%',
            top: isMobile ? '64%' : '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: ABOUT_US_PANEL_GAP,
            width: ABOUT_US_PANEL_WIDTH,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 描述列：与 ticker 等高，文字在列内绝对定位至激活槽，左对齐，垂直居中 */}
          <div
            style={{
              position: 'relative',
              width: descriptionWidth,
              height: itemH * VISIBLE_COUNT,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: ACTIVE_SLOT * itemH,
                left: 0,
                right: 0,
                height: itemH,
                display: 'flex',
                alignItems: 'center',
                textAlign: 'left',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentMemberIndex}
                  className="font-sans text-ink-muted"
                  style={{ fontSize: 'var(--text-intro)', lineHeight: 1.7, letterSpacing: '0.075em' }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                >
                  {TEAM_MEMBERS[currentMemberIndex].description}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* 竖排 ticker：高度固定，宽度固定（按激活态最大尺寸预留） */}
          <div
            className="relative overflow-hidden flex-shrink-0"
            style={{ height: itemH * VISIBLE_COUNT, width: tickerWidth }}
          >
            {/* 上方渐隐遮罩 */}
            <div
              className="absolute inset-x-0 top-0 z-10 pointer-events-none"
              style={{
                height: itemH * 1.2,
                background: 'linear-gradient(to bottom, #ece9e4 0%, transparent 100%)',
              }}
            />
            {/* 下方渐隐遮罩 */}
            <div
              className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
              style={{
                height: itemH * 1.2,
                background: 'linear-gradient(to top, #ece9e4 0%, transparent 100%)',
              }}
            />

            {/* 无限滚动列表（3 倍长度） */}
            <motion.div
              className="flex flex-col items-end"
              animate={{ y: translateY }}
              transition={
                skipTransition
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 200, damping: 30 }
              }
            >
              {INFINITE_ITEMS.map((member, i) => {
                const isActive = i === rawOffset;
                return (
                  <motion.div
                    key={`${i}-${member.name}`}
                    className="flex w-full items-center justify-end gap-4 cursor-pointer select-none"
                    style={{ height: itemH, width: '100%' }}
                    animate={{ opacity: isActive ? 1 : 0.28 }}
                    transition={{ duration: 0.35 }}
                    onClick={() => handleClick(i)}
                  >
                    {/* 昵称 */}
                    <span
                      className="min-w-0 flex-1 font-serif text-ink-strong tracking-wide transition-all duration-300"
                      style={{
                        fontSize: isActive ? 'calc(var(--text-intro) * 0.88)' : 'calc(var(--text-base) * 0.94)',
                        fontWeight: isActive ? 700 : 400,
                        textAlign: 'right',
                        lineHeight: isActive ? 1.35 : 1.25,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {member.name}
                    </span>

                    {/* 圆形头像 */}
                    <motion.div
                      className="rounded-full bg-paper-strong flex-shrink-0 flex items-center justify-center overflow-hidden border-2"
                      animate={{
                        width: isActive ? '6rem' : '4rem',
                        height: isActive ? '6rem' : '4rem',
                        borderColor: isActive ? '#c23643' : '#cbbdb5',
                      }}
                      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                    >
                      {member.avatar ? (
                        <Image
                          src={member.avatar}
                          alt={member.name}
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span
                          className="font-serif text-ink-muted"
                          style={{ fontSize: isActive ? 'var(--text-intro)' : 'var(--text-base)' }}
                        >
                          {member.name.slice(0, 1)}
                        </span>
                      )}
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
