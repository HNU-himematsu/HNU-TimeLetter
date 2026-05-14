'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * 红色引导线 (Red Guide Line)
 *
 * 横跨"关于企划"→"关于我们"→"鸣谢"三个页面的 #c23643 折线。
 * - 宽度 100px，圆角端点
 * - 图层位于文字下方、背景上方（z-index: 1）
 * - 完整连续折线（P4→P5 跨越"关于我们"页面）
 * - 使用 stroke-dasharray / stroke-dashoffset 实现描边曝光动画
 * - 非可逆单向线性插值：向下滚动时正向曝光，向上回滚时冻结在历史最远端
 *
 * 路径坐标（相对占比）：
 *   关于企划页：P1(ribbonX,0%) → P_bend(沿开屏页斜率延伸) → P4(107.5%,40.43%)
 *   鸣谢页：    P5(-2.19%,65.40%) → P6(32%,97%)
 *
 * 衔接细节：
 *  - 路径从 P1 开始 —— P1 精确位于首屏底边（= 丝带视觉终点），
 *    因此用户刚开始下滑即可看到引导线从丝带下方伸出，无"空走"。
 *  - ribbonX 使用 20%vw - 50px 动态计算（对应丝带 100px 宽容器 + col-start-1 justify-end），
 *    保证在所有屏幕尺寸下都与丝带中心精确对齐。
 *  - P1→P_bend 段沿用开屏页引导线 (60vw,0)→(20vw-50,100vh) 的斜率，
 *    这样开屏页底边的扫动直线和 GuideLine 第一段视觉上是同一根直线，
 *    在交界线（首屏底）严丝合缝，整段「关于企划」内只有一次拐弯（在 P_bend）。
 *  - P4→P5 是跨越"关于我们"整个页面的连续折线段。
 *
 * 渲染区域裁剪（关键）：
 *  - SVG 的可视区域通过蒙版硬裁剪：顶边 = apTop - 60（保留 P1 圆角端点从丝带
 *    下方长出的视觉余量），底边 = `crTop + crH + FOOTER_TEXT_TOP_OFFSET - 10`。
 *  - `FOOTER_TEXT_TOP_OFFSET = 34px` 由 Footer.tsx 布局直接推导：外层 nav 是 `py-5` (20px)，
 *    外层 `<a>` 自带 `py-3.5` (14px)，第一个 link 文本 `<span>` 顶边约在 footer 顶边下
 *    20 + 14 = 34px。再减 10px 安全间隙即为引导线视觉尾端允许伸到的最低点。
 *  - 为什么不测量 footer DOM：Footer 是 `position: fixed`，`getBoundingClientRect()` 返回
 *    视区相对坐标。用 `rect.top + scrollY - containerTop` 转换在 `scrollY=0` 时会得到
 *    负值，令 `svgHeight` 负号、浏览器忽略 height，引导线将完全不可见。
 *  - 效果：引导线视觉尾端伸入 footer 的 #C23643 红色区域（与页脚背景同色蟍融，
 *    呈现"线条归到红带"的视觉效果），同时严格停在首条链接文本上方 10px，
 *    避免覆盖 QQ 交流群 / HIMEMATSU / 版权条。
 *  - 配合 `overflow: hidden`，任何超出底边的描边（包括 P6 圆角端点的外沿）都会被
 *    SVG 视口硬裁剪。
 *  - 因此 P6 故意放在 `crBottom + 80`（超出蒙版底边 56px），让 stroke 主体而非
 *    仅仅圆角帽填满蒙版底边——这样无论 P5→P6 的角度如何，尾部视觉都硬齐
 *    到 `crBottom + 24`（红带内 24px），消除「有地方没碰到」的缝隙。
 */

interface GuideLineProps {
  /** 三个 section 容器的 ref：[关于企划, 关于我们, 鸣谢] */
  sectionRefs: React.RefObject<HTMLDivElement | null>[];
}

/**
 * 路径分段缓存：用于 y-aware 进度映射。每段保存起止 y、累积长度。
 * y 为 ScrollSections 容器内坐标系。
 * 最后一段（P5→P6）的 y1 已被 clamp 到 svgBottom（= 鸣谢页底边）：P6 实际在
 * 蒙版底下方 80px，clamp 保证"view.bottom == 鸣谢底边" 时进度 = 1.0。
 */
interface PathSegment {
  y0: number;
  y1: number;
  len0: number;
  len1: number;
}

export function GuideLine({ sectionRefs }: GuideLineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [pathD, setPathD] = useState('');
  const [svgDimensions, setSvgDimensions] = useState({ top: 0, height: 0 });
  const totalLengthRef = useRef(0);
  const cachedMaxProgress = useRef(0);
  // y-aware 映射所需数据
  const segmentsRef = useRef<PathSegment[]>([]);
  const containerTopRef = useRef(0);
  const svgBottomRef = useRef(0);

  /**
   * 根据三个 section 的实际 DOM 位置计算 SVG 路径坐标
   */
  const recalculate = useCallback(() => {
    const aboutProject = sectionRefs[0]?.current;
    const aboutUs = sectionRefs[1]?.current;
    const credits = sectionRefs[2]?.current;
    if (!aboutProject || !aboutUs || !credits) return;

    const vw = window.innerWidth;

    // 获取各 section 相对于 ScrollSections 容器的位置
    const container = aboutProject.parentElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top + window.scrollY;

    const apRect = aboutProject.getBoundingClientRect();
    const apTop = apRect.top + window.scrollY - containerTop;
    const apH = apRect.height;

    const crRect = credits.getBoundingClientRect();
    const crTop = crRect.top + window.scrollY - containerTop;
    const crH = crRect.height;

    // 丝带水平中心：丝带位于 col-start-1（0~20%vw）的 flex justify-end 内，宽 100px。
    // 所以丝带中心 x = 20%vw - 50px（响应式，任意屏宽均与丝带精确对齐）。
    const ribbonX = vw * 0.2 - 50;

    // 计算路径各点的像素坐标（相对于 ScrollSections 容器）
    // P1: 沿开屏页扫动线斜率从「丝带下方、首屏底边」再向上外延 GUIDE_OVERSHOOT 像素，
    //   把 stroke 起点推到首屏底边（= ScrollSections 容器顶边）之上的开屏页区域。
    //   开屏页 section 自身 z-index 更高，外延部分被开屏页遮挡，不影响视觉；
    //   但能保证视口跨过交界线时，下方斜带与开屏页扫动线在交界线上严丝合缝
    //   （没有「先看到 GuideLine 端点圆角，再看到下一段」的台阶）。
    const introDx = vw * 0.2 - 50 - vw * 0.6; // = -vw*0.4 - 50
    const introDy = window.innerHeight;
    const introHypot = Math.hypot(introDx, introDy);
    const introUx = introHypot === 0 ? 0 : introDx / introHypot;
    const introUy = introHypot === 0 ? 1 : introDy / introHypot;
    const GUIDE_OVERSHOOT = 60;
    const p1 = {
      x: ribbonX - introUx * GUIDE_OVERSHOOT,
      y: apTop - introUy * GUIDE_OVERSHOOT,
    };
    // P_bend: 沿开屏页扫动线 (60vw,0)→(20vw-50,100vh) 的斜率从交界线 (ribbonX, apTop)
    //   继续延伸 10% apH。GuideLine 首段沿同一方向延伸 → 与开屏页扫动线视觉上为
    //   同一根直线。整个「关于企划」section 内只有 P_bend 一次拐弯。
    const bendDy = apH * 0.10;
    const bendDx = (introDx / introDy) * bendDy;
    const pBend = { x: ribbonX + bendDx, y: apTop + bendDy };
    const p4 = { x: vw * 1.075, y: apTop + apH * 0.4043 };
    // P5 在鸣谢页（跨越了关于我们页面）
    const p5 = { x: vw * -0.0219, y: crTop + crH * 0.654 };
    // P6: 故意推到 `crBottom + 80`，远在蒙版底边 (`crBottom + 24`) 之下。
    //     既然 SVG 的 `overflow: hidden` 硬裁剪，超过蒙版的部分一律不渲染；
    //     把线条终点放到蒙版外，能保证 stroke 主体（100px 宽）填满整个蒙版
    //     底边，不管 P5→P6 的角度，尾部视觉上都确实抵达页脚红带。
    //     若终点落在 credits 内部（例如 0.97*crH），线会在蒙版底边之上结束，
    //     视觉上形成「没碰到页脚」的缝隙。
    const p6 = { x: vw * 0.32, y: crTop + crH + 80 };

    // SVG 覆盖范围：蒙版裁剪盒。
    //   顶边：P1 上方 60px（容纳 stroke 圆角端点，使引导线从丝带下方长出）
    //   底边：鸣谢页底边 = footer 顶边（交界线）；不额外附加偏移，保证蒙版
    //        与交界线严格平齐。P6 故意在交界线下方 80px，stroke 主体由蒙版
    //        硬裁剪，尾部视觉上刚好停在交界线。
    const svgTop = p1.y - 60;
    const svgBottom = crTop + crH;
    const svgHeight = svgBottom - svgTop;

    // 所有 Y 坐标相对于 SVG 顶部
    const toLocal = (p: { x: number; y: number }) => ({
      x: p.x,
      y: p.y - svgTop,
    });

    const lp1 = toLocal(p1);
    const lpBend = toLocal(pBend);
    const lp4 = toLocal(p4);
    const lp5 = toLocal(p5);
    const lp6 = toLocal(p6);

    // 一条完整连续折线：P1→P_bend→P4→P5→P6（关于企划内仅 P_bend 一次拐弯）
    const d = [
      `M ${lp1.x} ${lp1.y}`,
      `L ${lpBend.x} ${lpBend.y}`,
      `L ${lp4.x} ${lp4.y}`,
      `L ${lp5.x} ${lp5.y}`,
      `L ${lp6.x} ${lp6.y}`,
    ].join(' ');

    // y-aware 进度映射所需的段信息：每段 (y0, y1, len0, len1) 全部在容器坐标系
    // 使用真实几何（不 clamp y1）：drawn 终点精确落在 refY 对应的路径点上。
    // svgBottom（= 鸣谢底 = 交界线）由 animate() 里做 snap：一旦 refY >= svgBottom
    // 就强制 progress = 1；视觉上这一跳被蒙版遮住（新画的 80px 都在蒙版下）。
    const pts = [p1, pBend, p4, p5, p6];
    const segs: PathSegment[] = [];
    let cum = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const seg = Math.sqrt(dx * dx + dy * dy);
      segs.push({ y0: a.y, y1: b.y, len0: cum, len1: cum + seg });
      cum += seg;
    }
    segmentsRef.current = segs;
    containerTopRef.current = containerTop;
    svgBottomRef.current = svgBottom;

    setPathD(d);
    setSvgDimensions({ top: svgTop, height: svgHeight });
  }, [sectionRefs]);

  // 初始化 + resize 时重新计算路径
  useEffect(() => {
    const timer = setTimeout(recalculate, 200);
    window.addEventListener('resize', recalculate);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', recalculate);
    };
  }, [recalculate]);

  // pathD 更新后重新获取 totalLength
  useEffect(() => {
    if (pathRef.current && pathD) {
      totalLengthRef.current = pathRef.current.getTotalLength();
      pathRef.current.style.strokeDasharray = `${totalLengthRef.current}`;
      pathRef.current.style.strokeDashoffset = `${totalLengthRef.current}`;
    }
  }, [pathD]);

  // 滚动驱动描边曝光动画（非可逆）
  useEffect(() => {
    if (!pathD) return;

    let rafId: number;

    const animate = () => {
      const path = pathRef.current;
      const segs = segmentsRef.current;
      if (!path || totalLengthRef.current === 0 || segs.length === 0) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const scrollY = window.scrollY;
      const vp = window.innerHeight;
      const containerTop = containerTopRef.current;
      const svgBottom = svgBottomRef.current;

      // y-aware 进度映射：让画出的线尾跟随「视口某一 y 基准线在路径上的 y 位置」
      //
      // 简单的线性映射（progress = (scrollY - startY) / (endY - startY) → drawn = progress * totalLength）
      // 在路径几何不均匀时会出现「线头走在视口下面」：
      // ─ P1→P4 段（小 y 范围 ~13%）占了 ~28% 路径长度 → 密集区
      // ─ P4→P5 段（大 y 跨越 ~73%）占了 ~58% 路径长度 → 稀疏区
      // 线性映射在中段滚动时会把 drawn-end 推到远比视口底低的 y。
      //
      // 当前采用 refY = scrollY + vp*anchor（文档坐标）后减去 containerTop 转到
      // 容器坐标系，再在折线上按 y 查长度。drawn 终点精确落在 refY 对应的路径点上。
      //
      // 三段 anchor 策略（用 max-merge 让它们平滑衔接）：
      // ─ 启动（scrollY <= STARTUP_END）：跟视口底（anchor=1.0），保证微量下滑时
      //   线立即从丝带下方伸出。超过 STARTUP_END 后冻结这个分量（停止推进），
      //   仅靠 mid 段驱动；用户继续滚动时尾部的视觉 y 从视口底自然上升到 60%，
      //   无跳跃（因为 drawn 在 cachedMax 下保持不变，滚动只改变相对视口 y）。
      // ─ 中段（STARTUP_END < scrollY < TRANSITION_START）：anchor=0.6 锁在视口 60%。
      // ─ 触底（scrollY >= TRANSITION_START）：anchor 线性从 0.6 → 1.0，尾部下沉到
      //   视口底与页脚交界线汇合；refY 越过 svgBottom 时 snap 到 100%，完成描边。
      const STARTUP_END = 500; // 前 500px 滚动跟视口底，保证微量下滑线能冒出
      const snapScroll = svgBottom - vp + containerTop; // viewBottom == svgBottom 时的 scrollY
      const transitionStart = snapScroll * 0.7; // 最后 30% 滚动 anchor 过渡到 1.0

      let midAnchor = 0.6;
      if (scrollY > transitionStart && snapScroll > transitionStart) {
        const t = Math.min(1, (scrollY - transitionStart) / (snapScroll - transitionStart));
        midAnchor = 0.6 + 0.4 * t;
      }
      const refY_mid = scrollY + vp * midAnchor - containerTop;

      // 启动阶段用视口底 anchor=1.0；超过 STARTUP_END 后 scrollY 冻结在 STARTUP_END，
      // 令 refY_startup 停止增长，交棒给 refY_mid。
      const startupScrollY = Math.min(scrollY, STARTUP_END);
      const refY_startup = startupScrollY + vp - containerTop;

      const lenAt = (y: number): number => {
        if (y <= segs[0].y0) return 0;
        for (const seg of segs) {
          if (y <= seg.y1) {
            const frac = (seg.y1 === seg.y0) ? 0 : (y - seg.y0) / (seg.y1 - seg.y0);
            return seg.len0 + frac * (seg.len1 - seg.len0);
          }
        }
        return segs[segs.length - 1].len1;
      };

      const segTotal = segs[segs.length - 1].len1;
      let rawProgress = Math.max(lenAt(refY_mid), lenAt(refY_startup)) / segTotal;

      // 最终 snap：视口底越过鸣谢底边（= 蒙版底 = 交界线）→ 线画完。
      // 超出蒙版底边的路径段被 overflow:hidden 硬裁剪，视觉无跳变。
      const viewBottom = scrollY + vp - containerTop;
      if (viewBottom >= svgBottom) {
        rawProgress = 1;
      }
      rawProgress = Math.max(0, Math.min(1, rawProgress));

      // 非可逆：只取历史最大值（Math.max(cachedMaxScroll, currentScroll) 算法）
      cachedMaxProgress.current = Math.max(cachedMaxProgress.current, rawProgress);

      const offset = totalLengthRef.current * (1 - cachedMaxProgress.current);
      path.style.strokeDashoffset = `${offset}`;

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [pathD, sectionRefs]);

  if (!pathD) return null;

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: svgDimensions.top,
        left: 0,
        width: '100%',
        height: svgDimensions.height,
        pointerEvents: 'none',
        zIndex: 1,
        // 蒙版：硬裁剪所有超出 SVG 视口的描边（含圆角端点外沿），
        // 保证引导线绝不渲染到鸣谢页底边之下（= footer 之上）。
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="#c23643"
        strokeWidth={100}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
