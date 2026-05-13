'use client'

import { useEffect } from 'react'
import { useMotionValue } from 'framer-motion'

/**
 * 全局鼠标位置追踪 Hook。
 *
 * 在 window 上以 passive 模式监听 mousemove 事件，将 clientX / clientY
 * 写入 framer-motion MotionValue。MotionValue 属于外部可变值存储，
 * 其变更不触发 React 组件的重渲染，仅驱动 framer-motion 内部
 * 动画管线更新已绑定的 DOM 属性。
 *
 * @returns mouseX / mouseY —— MotionValue<number>，可绑定到
 *          motion.div 的 style 属性，或传入 useSpring / animate 等 API。
 */
export function useMousePosition() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  return { mouseX, mouseY } as const
}
