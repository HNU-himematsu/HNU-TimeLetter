'use client'

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  animate,
} from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// LERP 延迟阻尼系数
//
// 外圈与内点各自以独立的除数执行逐帧线性插值：
//   当前位置 += (鼠标真实位置 - 当前位置) / 除数
//
// 除数越大，光标图层响应越慢，视觉上的粘稠延迟感越强。
// ---------------------------------------------------------------------------

/** 外圈 LERP 除数。高值产生较强的视觉延迟感。 */
const OUTER_DIVISOR = 12
/** 内点 LERP 除数。较低值使内点对外圈有更快的追踪响应。 */
const INNER_DIVISOR = 6

// ---------------------------------------------------------------------------
// 交互元素检测
// ---------------------------------------------------------------------------

/**
 * 判断 DOM 元素或其祖先链中是否存在可交互元素。
 *
 * 检测规则（向上遍历直至 document.body）：
 *  - 原生交互标签：button / a / input / select / textarea
 *  - ARIA 角色：role="button"
 *  - Tailwind 标记：class 中含 cursor-pointer
 *  - 显式标记：data-cursor-interactive 属性
 */
function isInteractive(el: Element | null): boolean {
  while (el && el !== document.body) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') return true
    if (el.getAttribute('role') === 'button') return true
    if (el.classList.contains('cursor-pointer')) return true
    if (el.hasAttribute('data-cursor-interactive')) return true
    el = el.parentElement
  }
  return false
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

/**
 * 高阶延迟追踪光标（Sticky Cursor）
 *
 * 在视口顶层渲染两个固定定位的圆形图层，各自以不同的 LERP 除数
 * 追踪鼠标位置，产生分层的粘稠延迟视觉效果。
 *
 * 鼠标坐标采集自 window mousemove 事件，写入 useMotionValue
 * （内存变量，不触发 React 组件重渲染）。每帧通过
 * requestAnimationFrame 执行 LERP 累加，将插值结果写入
 * useMotionValue，由 framer-motion 引擎直接更新 DOM style。
 *
 * 光标图层使用 SVG feColorMatrix 滤镜实现站点调色反色。
 * 矩阵对每个 RGB 通道取反（× -1）后叠加站点主题色偏移量，
 * 使白色光标在深色背景呈现白色、在浅色背景呈现与站点色调
 * 协调的暗色，替代 mix-blend-mode: difference 的纯反差算法。
 *
 * z-index 设置为 9999，低于 site-frame-border（10001），
 * 光标在视觉上位于画框描边层之下，与站点层级体系一致。
 *
 * 飞书公告弹窗联动：当 useAppStore.isAnnouncementOpen 为 true
 * 时，光标 DOM 不渲染（返回 null）。飞书 SDK 创建的跨域 iframe
 * 会截获 mousemove 事件，光标无法在其中追踪，因此直接隐藏
 * 而非定格在 iframe 边界。弹窗关闭后光标恢复渲染，RAF 插值
 * 循环始终运行，恢复时光标位置无跳变。
 *
 * 内点缩放联动：通过 document mouseover 事件自动检测光标
 * 是否位于可交互元素（button / a / 含 cursor-pointer 类等）上方。
 * 悬停时外圈放大至 110%（scale: 1.1）、内点缩小至 50%（scale: 0.5），
 * 离开后均恢复 1.0，过渡时长 0.3s、Power2.easeInOut 缓动。
 * 无需任何组件主动上报状态，StickyCursor 独立完成检测与动画。
 *
 * 光标初始化策略：组件挂载时无法获知鼠标位置（浏览器不提供
 * 同步读取 API），因此光标在首次 mousemove 之前不可见。首次
 * mousemove 触发时，所有位置值（mouseX/Y、LERP 累加器、
 * outerX/Y、innerX/Y）瞬时对齐到当前鼠标坐标，光标立即在
 * 正确位置出现，之后启动正常的 LERP 延迟追踪循环。
 *
 * 触摸设备上自动隐藏（无物理光标可追踪）。
 * 视口宽度低于 1024px 时同样隐藏，防止平板与大屏手机误显示。
 * 尊重 prefers-reduced-motion 用户偏好。
 */
export function StickyCursor() {
  const prefersReducedMotion = useReducedMotion()

  // ---- 飞书公告弹窗状态（开启时隐藏光标） ----
  const isAnnouncementOpen = useAppStore((s) => s.isAnnouncementOpen)

  // ---- 设备检测（触摸设备 + 小屏设备均隐藏光标） ----
  const [isTouchDevice, setIsTouchDevice] = useState(true)
  useEffect(() => {
    const check = () => {
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches
      const isSmallScreen = window.innerWidth < 1024
      setIsTouchDevice(hasCoarsePointer || isSmallScreen)
    }
    check()
    window.addEventListener('resize', check, { passive: true })
    return () => window.removeEventListener('resize', check)
  }, [])

  // ---- 鼠标实时坐标（内存变量，不触发重渲染） ----
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  // ---- 外圈插值后的展示坐标 ----
  const outerX = useMotionValue(0)
  const outerY = useMotionValue(0)

  // ---- 内点插值后的展示坐标 ----
  const innerX = useMotionValue(0)
  const innerY = useMotionValue(0)

  // ---- 外圈缩放因子（1.0 = 正常，1.1 = 悬停时放大至 110%） ----
  const outerScale = useMotionValue(1)

  // ---- 内点缩放因子（1.0 = 正常，0.5 = 悬停可交互元素时缩小至 50%） ----
  const innerScale = useMotionValue(1)

  // ---- LERP 累加器（ref 持有，避免每帧读写 MotionValue 的类型开销） ----
  const lerpRef = useRef({
    outerX: 0,
    outerY: 0,
    innerX: 0,
    innerY: 0,
  })

  // ---- window mousemove 事件采集 ----
  useEffect(() => {
    if (prefersReducedMotion) return

    function handleMouseMove(e: MouseEvent) {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY, prefersReducedMotion])

  // ---- RAF 逐帧 LERP 插值循环 ----
  useEffect(() => {
    if (prefersReducedMotion || isTouchDevice) return

    let rafId: number

    function loop() {
      const targetX = mouseX.get()
      const targetY = mouseY.get()
      const l = lerpRef.current

      // LERP 公式：current += (target - current) / divisor
      l.outerX += (targetX - l.outerX) / OUTER_DIVISOR
      l.outerY += (targetY - l.outerY) / OUTER_DIVISOR
      l.innerX += (targetX - l.innerX) / INNER_DIVISOR
      l.innerY += (targetY - l.innerY) / INNER_DIVISOR

      // 写入 MotionValue，framer-motion 直接更新 DOM style
      outerX.set(l.outerX)
      outerY.set(l.outerY)
      innerX.set(l.innerX)
      innerY.set(l.innerY)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [prefersReducedMotion, isTouchDevice, mouseX, mouseY, outerX, outerY, innerX, innerY])

  // ---- 内点缩放：document mouseover 自动检测可交互元素 ----
  useEffect(() => {
    if (prefersReducedMotion || isTouchDevice) return

    let currentHovering = false

    function handleMouseOver(e: MouseEvent) {
      const hovering = isInteractive(e.target as Element)
      if (hovering !== currentHovering) {
        currentHovering = hovering
        void animate(outerScale, hovering ? 1 : 1, {
          duration: 0.3,
          ease: [0.45, 0.05, 0.55, 0.95], // Power2.easeInOut
        })
        void animate(innerScale, hovering ? 0.6 : 1, {
          duration: 0.3,
          ease: [0.45, 0.05, 0.55, 0.95], // Power2.easeInOut
        })
      }
    }

    document.addEventListener('mouseover', handleMouseOver, { passive: true })
    return () => document.removeEventListener('mouseover', handleMouseOver)
  }, [prefersReducedMotion, isTouchDevice, outerScale, innerScale])

  // ---- 光标初始化守卫（首次 mousemove 之前不可见） ----
  const [initialized, setInitialized] = useState(false)

  // ---- 首次 mousemove：瞬时对齐所有位置值，绕过 LERP ----
  useEffect(() => {
    if (prefersReducedMotion || isTouchDevice) return

    function handleFirstMove(e: MouseEvent) {
      const cx = e.clientX
      const cy = e.clientY

      // 真实坐标
      mouseX.set(cx)
      mouseY.set(cy)

      // LERP 累加器
      lerpRef.current.outerX = cx
      lerpRef.current.outerY = cy
      lerpRef.current.innerX = cx
      lerpRef.current.innerY = cy

      // 展示坐标
      outerX.set(cx)
      outerY.set(cy)
      innerX.set(cx)
      innerY.set(cy)

      setInitialized(true)
    }

    window.addEventListener('mousemove', handleFirstMove, { once: true, passive: true })
    return () => window.removeEventListener('mousemove', handleFirstMove)
  }, [prefersReducedMotion, isTouchDevice, mouseX, mouseY, outerX, outerY, innerX, innerY])

  // ---- 不渲染光标的条件 ----
  if (prefersReducedMotion || isTouchDevice || isAnnouncementOpen || !initialized) {
    return null
  }

  return (
    <>
      {/*
       * SVG feColorMatrix 滤镜定义。
       * 矩阵对 R/G/B 通道取反（× -1）后叠加站点主题色偏移量。
       * 滤镜通过 CSS backdrop-filter 施加于光标元素的背景区域，
       * 实现逐像素混合（等效 mix-blend-mode: difference 的调色版本）。
       * display: none 使 SVG 不参与布局，仅作为滤镜资源。
       */}
      <svg style={{ display: 'none' }} aria-hidden>
        <filter id="color-swap-filter">
          <feColorMatrix
            type="matrix"
            values="
              -1  0  0  0  1.68627
               0 -1  0  0  1.12549
               0  0 -1  0  1.15686
               0  0  0  1  0
            "
          />
        </filter>
      </svg>

      {/*
        * 外圈轨道：4vw 直径圆形（clamp 44px~64px），LERP 除数 12。
        * 悬停在可交互元素上时放大至 110%（scale: 1.1）。
        * backdrop-filter 对圆形区域内背景像素施加 feColorMatrix 滤镜。
        * 深色背景 → 白色圆；浅色背景 → 站色调暗色圆。
        */}
      <motion.div
        className={cn(
          'pointer-events-none fixed left-0 top-0 z-[9999]',
          'rounded-full',
        )}
        style={{
          width: 'clamp(44px, 4vw, 64px)',
          height: 'clamp(44px, 4vw, 64px)',
          x: outerX,
          y: outerY,
          scale: outerScale,
          translateX: '-50%',
          translateY: '-50%',
          willChange: 'transform',
          backdropFilter: 'url(#color-swap-filter)',
        }}
        aria-hidden
      />

      {/*
        * 内层精确点：1.3vw 直径圆形（clamp 14.3px~20.8px），与大圆比例固定，LERP 除数 6。
        * 悬停在可交互元素上时缩小至 50%（scale: 0.5），通过 document mouseover 自动检测。
        */}
      <motion.div
        className={cn(
          'pointer-events-none fixed left-0 top-0 z-[9999]',
          'rounded-full',
        )}
        style={{
          width: 'clamp(14.3px, 1.3vw, 20.8px)',
          height: 'clamp(14.3px, 1.3vw, 20.8px)',
          x: innerX,
          y: innerY,
          scale: innerScale,
          translateX: '-50%',
          translateY: '-50%',
          willChange: 'transform',
          backdropFilter: 'url(#color-swap-filter)',
        }}
        aria-hidden
      />
    </>
  )
}
