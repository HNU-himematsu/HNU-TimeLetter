'use client'

import {
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type ElementType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  animate,
} from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'

// ---------------------------------------------------------------------------
// 缓动函数常量
//
// 每条曲线以 cubic-bezier 四元组定义，对应 framer-motion animate()
// 的 ease 参数。命名沿用 GSAP 生态中的 Power 系列缓动约定。
// ---------------------------------------------------------------------------

/**
 * 快速出弯缓动：cubic-bezier(0.25, 1, 0.5, 1)
 * 应用于按钮磁吸位移的 mousemove 追踪动画。
 * 特征：起始阶段快速响应鼠标，末端缓慢收敛至目标位置。
 */
const POWER4_EASE_OUT: readonly [number, number, number, number] = [0.25, 1, 0.5, 1]

/**
 * 对称缓入缓出：cubic-bezier(0.45, 0.05, 0.55, 0.95)
 * 应用于填充层（fill）的上下位移动画。
 * 特征：两端平缓，中间加速，适合面板滑入滑出。
 */
const POWER2_EASE_IN_OUT: readonly [number, number, number, number] = [0.45, 0.05, 0.55, 0.95]

/**
 * 急加速缓入：cubic-bezier(0.7, 0, 0.84, 0)
 * 应用于鼠标进入时文本颜色翻转（暗→亮）。
 * 特征：前半段快速逼近目标色，后半段平缓收尾。
 */
const POWER3_EASE_IN: readonly [number, number, number, number] = [0.7, 0, 0.84, 0]

/**
 * 急减速缓出：cubic-bezier(0.22, 0.89, 0.38, 1)
 * 应用于鼠标离开时文本颜色恢复（亮→暗）。
 * 特征：起始快速变色，后半段平缓到达目标色。
 * 与入场 Power3.easeIn 配合，在视觉上形成非对称的色彩过渡节奏。
 */
const POWER3_EASE_OUT: readonly [number, number, number, number] = [0.22, 0.89, 0.38, 1]

// ---------------------------------------------------------------------------
// 色彩方案预设
// ---------------------------------------------------------------------------

/**
 * 文本颜色转换方案集合。
 * 每种方案定义了鼠标悬停前后的颜色对（from → to）。
 */
const COLOR_SCHEMES = {
  /** 暗色 ↔ 白色：适用于深色文字在浅色背景上翻转 */
  change: { from: '#171717', to: '#FFFFFF' } as const,
  /** 黑色 ↔ 嫩绿：适用于强调色按钮 */
  change2: { from: '#000000', to: '#C9FF85' } as const,
  /** 白色 ↔ 黑色：适用于浅色文字在深色背景上翻转 */
  change3: { from: '#FFFFFF', to: '#000000' } as const,
}

type ColorScheme = keyof typeof COLOR_SCHEMES

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MagneticButtonProps {
  /** 按钮文本内容（渲染于最内层色彩翻转元素中） */
  children: ReactNode
  /** 外层容器附加 className */
  className?: string
  /** 内部背景填充层附加 className */
  fillClassName?: string
  /** 文本位移层附加 className（该层负责磁吸视差位移） */
  textClassName?: string
  /** 文本色彩层附加 className（该层负责颜色翻转） */
  textInnerClassName?: string
  /**
   * 磁吸位移强度（像素）。
   * 鼠标相对按钮中心的归一化偏移 [-0.5, 0.5] 乘以该值得到实际像素位移。
   * 默认值 100。
   */
  strength?: number
  /**
   * 文本层磁吸位移强度（像素）。
   * 独立于按钮整体的位移量，产生视差位移差（parallax）。
   * 未指定时默认取 strength 的 50%。
   */
  textStrength?: number
  /**
   * 色彩方案预设。
   * 'change'（默认）：暗色 ↔ 白色
   * 'change2'：黑色 ↔ 嫩绿
   * 'change3'：白色 ↔ 黑色
   * 设为 null 可禁用文本色彩动画。
   */
  colorScheme?: ColorScheme | null
  /**
   * 磁吸效果激活的最小视口宽度（px），默认 540。
   * 窗口宽度低于此值时磁吸位移静默禁用，
   * 但填充层位移与文本色彩动画保持正常运行。
   */
  magneticBreakpoint?: number
  /** 渲染为其他元素（如 a 或 Next.js Link 组件） */
  as?: ElementType
  /** href 属性（当 as 为链接元素时传入） */
  href?: string
  /** 点击回调 */
  onClick?: () => void
  /** 无障碍标签 */
  'aria-label'?: string
  /** 禁用交互 */
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

/**
 * 磁吸交互按钮。
 *
 * DOM 层级结构：
 *   <外层容器>              — overflow: hidden，裁剪溢出内容
 *     <磁吸交互层>          — mousemove / mouseleave 事件监听
 *       <填充层 Fill>       — translateY 控制显隐（76% → 0% → -76%）
 *       <文本位移层>        — 独立磁吸视差位移
 *         <文本色彩层>      — 悬停时触发颜色翻转
 *           {children}
 *
 * 动效行为：
 * - mousemove：按钮整体以归一化坐标偏移量乘以磁吸强度作为目标位移，
 *   执行 1.5s Power4.easeOut 动画追踪鼠标。
 * - mouseleave：按钮整体以弹簧物理引擎（spring）回弹至原点 (0, 0)。
 * - mouseenter：填充层从 translateY(76%) 滑入至 0%（0.6s），
 *   文本色彩立即翻转（0.3s，无延迟）。
 * - mouseleave：填充层滑出至 translateY(-76%)（0.6s），
 *   文本色彩延迟 0.3s 后恢复（0.3s）。
 *
 * GPU 加速策略：所有位移元素应用 will-change: transform。
 *
 * 可访问性：
 * - 尊重 prefers-reduced-motion：全部动效静止。
 * - 响应式磁吸断点：窗口宽度低于 magneticBreakpoint 时禁用磁吸位移。
 */
export function MagneticButton({
  children,
  className,
  fillClassName,
  textClassName,
  textInnerClassName,
  strength = 100,
  textStrength,
  colorScheme = 'change',
  magneticBreakpoint = 540,
  as: Component = 'button',
  href,
  onClick,
  'aria-label': ariaLabel,
  disabled,
}: MagneticButtonProps) {
  // ---- 可访问性：prefers-reduced-motion ----
  const prefersReducedMotion = useReducedMotion()

  // ---- 光标悬停联动 ----
  const setCursorHovering = useAppStore((s) => s.setCursorHovering)

  // ---- 响应式磁吸断点守卫 ----
  const [magneticEnabled, setMagneticEnabled] = useState(true)
  useEffect(() => {
    const check = () => setMagneticEnabled(window.innerWidth > magneticBreakpoint)
    check()
    window.addEventListener('resize', check, { passive: true })
    return () => window.removeEventListener('resize', check)
  }, [magneticBreakpoint])

  // 组件卸载时重置光标悬停状态（防止在 hover 态下页面切换导致光标定格）
  useEffect(() => {
    return () => {
      setCursorHovering(false)
    }
  }, [setCursorHovering])

  // 磁吸是否实际激活
  const isMagneticActive = !prefersReducedMotion && magneticEnabled

  // ---- 文本层磁吸强度 ----
  const effectiveTextStrength = textStrength ?? strength * 0.5

  // ---- 容器 Ref ----
  const containerRef = useRef<HTMLDivElement>(null)

  // ---- 磁吸位移目标值（useMotionValue，内存变量，不触发 React 重渲染） ----
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const tx = useMotionValue(0)
  const ty = useMotionValue(0)

  // ---- 填充层 translateY（独立于磁吸位移的动画通道） ----
  const fillY = useMotionValue('76%')

  // ---- 悬停状态机 ----
  type HoverState = 'idle' | 'hovered' | 'leaving'
  const [hoverState, setHoverState] = useState<HoverState>('idle')

  // ---- 色彩配置 ----
  const scheme = colorScheme ? COLOR_SCHEMES[colorScheme] : null
  const textFrom = scheme?.from ?? '#171717'
  const textTo = scheme?.to ?? '#FFFFFF'

  // ---- mousemove 处理器 ----
  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (!isMagneticActive) return

      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds) return

      // 归一化坐标：范围 [-0.5, 0.5]
      const nx = (e.clientX - bounds.left) / bounds.width - 0.5
      const ny = (e.clientY - bounds.top) / bounds.height - 0.5

      // animate() 每次调用自动覆盖前一次同 MotionValue 的动画
      void animate(mx, nx * strength, {
        duration: 1.5,
        ease: POWER4_EASE_OUT,
      })
      void animate(my, ny * strength, {
        duration: 1.5,
        ease: POWER4_EASE_OUT,
      })
      void animate(tx, nx * effectiveTextStrength, {
        duration: 1.5,
        ease: POWER4_EASE_OUT,
      })
      void animate(ty, ny * effectiveTextStrength, {
        duration: 1.5,
        ease: POWER4_EASE_OUT,
      })
    },
    [isMagneticActive, strength, effectiveTextStrength, mx, my, tx, ty],
  )

  // ---- mouseenter 处理器 ----
  const handleMouseEnter = useCallback(() => {
    setHoverState('hovered')
    setCursorHovering(true)

    // 填充层滑入：76% → 0%
    void animate(fillY, '0%', {
      duration: 0.6,
      ease: POWER2_EASE_IN_OUT,
    })
  }, [fillY, setCursorHovering])

  // ---- mouseleave 处理器 ----
  const handleMouseLeave = useCallback(() => {
    // 磁吸回弹至原点，使用弹簧物理引擎产生简谐振荡
    if (isMagneticActive) {
      void animate(mx, 0, {
        type: 'spring',
        stiffness: 350,
        damping: 8,
        mass: 0.5,
        restSpeed: 0.5,
      })
      void animate(my, 0, {
        type: 'spring',
        stiffness: 350,
        damping: 8,
        mass: 0.5,
        restSpeed: 0.5,
      })
      void animate(tx, 0, {
        type: 'spring',
        stiffness: 350,
        damping: 8,
        mass: 0.5,
        restSpeed: 0.5,
      })
      void animate(ty, 0, {
        type: 'spring',
        stiffness: 350,
        damping: 8,
        mass: 0.5,
        restSpeed: 0.5,
      })
    }

    // 填充层滑出：0% → -76%
    void animate(fillY, '-76%', {
      duration: 0.6,
      ease: POWER2_EASE_IN_OUT,
    })

    setHoverState('leaving')
    setCursorHovering(false)
  }, [isMagneticActive, mx, my, tx, ty, fillY, setCursorHovering])

  // ---- 派生状态 ----
  const isHovered = hoverState === 'hovered'

  // ---- 文本色彩动画参数 ----
  // 入场：无延迟，0.3s Power3.easeIn
  // 离场：延迟 0.3s，0.3s Power3.easeOut
  // 延迟确保填充色块退出过半后再触发色彩恢复，避免视觉闪烁
  const textColorAnimate = prefersReducedMotion
    ? { color: textFrom }
    : { color: isHovered ? textTo : textFrom }

  const textColorTransition = prefersReducedMotion
    ? { duration: 0 }
    : isHovered
      ? {
          ease: POWER3_EASE_IN,
          duration: 0.3,
        }
      : {
          delay: 0.3,
          ease: POWER3_EASE_OUT,
          duration: 0.3,
        }

  // ------------------------------------------------------------------
  // 渲染
  // ------------------------------------------------------------------

  return (
    <Component
      href={href}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'relative inline-block overflow-hidden cursor-pointer',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      style={{ willChange: 'transform' } as React.CSSProperties}
    >
      {/* ---- 磁吸交互容器（mousemove / mouseleave 事件监听层） ---- */}
      <motion.div
        ref={containerRef}
        className="relative"
        style={{
          x: mx,
          y: my,
          willChange: 'transform',
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* ---- 内部背景填充层 Fill（translateY 控制显隐） ---- */}
        <motion.div
          className={cn(
            'absolute inset-0 -z-10',
            fillClassName ?? 'bg-[#171717]',
          )}
          style={{
            y: fillY,
            willChange: 'transform',
          }}
          aria-hidden
        />

        {/* ---- 文本位移层（磁吸视差 parallax） ---- */}
        <motion.span
          className={cn('relative block', textClassName)}
          style={{
            x: tx,
            y: ty,
            willChange: 'transform',
          }}
        >
          {/* ---- 文本色彩层（悬停颜色翻转目标） ---- */}
          <motion.span
            className={cn('block', textInnerClassName)}
            animate={textColorAnimate}
            transition={textColorTransition}
          >
            {children}
          </motion.span>
        </motion.span>
      </motion.div>
    </Component>
  )
}
