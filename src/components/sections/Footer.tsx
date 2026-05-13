'use client';

import Image from 'next/image';
import { useAppStore } from '@/lib/store';

/**
 * 页脚 (Footer)
 *
 * 揭露式视差动画 (Reveal Parallax)：
 *  - Footer 固定在视口底部 (position: fixed; bottom: 0; z-index: 0)
 *  - 主内容层（z-index: 1）在上方滚过时逐渐"揭开"底层页脚
 *  - 巨型 HIMEMATSU Logo 始终锚定在底部坐标系，可视面积随遮罩上移而增加
 *
 * 结构（自上而下）：
 *  1. 大页脚导航 — 4 张链接卡片
 *  2. 巨大化 HIMEMATSU.svg — 响应式占满宽度
 *  3. 次页脚版权信息条
 *
 * 配色：背景 #C23643，文字 #ECE9E4
 *
 * 注意：占位空间由 page.tsx 中的 FooterSpacer 组件负责。
 */

interface FooterLink {
  title: string;
  description: string;
  href?: string;
  onModal?: 'announcement';
}

const FOOTER_LINKS: FooterLink[] = [
  {
    title: '活动公告',
    description: '活动参与方式介绍',
    onModal: 'announcement',
  },
  {
    title: 'QQ 活动群',
    description: '投稿创作交流',
    href: 'https://qm.qq.com/q/cBMbFsbDS8',
  },
  {
    title: 'B站主页',
    description: '后续作品发表页面',
    href: 'https://space.bilibili.com/3546960162196234',
  },
  {
    title: 'GitHub 仓库',
    description: '网页项目源码',
    href: 'https://github.com/HNU-himematsu/HNU-TimeLetter',
  },
];

export function Footer() {
  const { openAnnouncement } = useAppStore();

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-0"
      style={{ backgroundColor: '#C23643' }}
    >
      {/* ─── 大页脚导航 ─── */}
      <nav className="w-full max-w-7xl mx-auto px-6 md:px-24 py-5">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 md:flex md:flex-wrap md:gap-14 md:justify-start">
          {FOOTER_LINKS.map((link) =>
            link.onModal === 'announcement' ? (
              <button
                key={link.title}
                type="button"
                onClick={openAnnouncement}
                className="group flex flex-col gap-2.5 py-3.5 px-3 md:px-8 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <span
                  className="text-xl font-sans tracking-wide"
                  style={{ color: '#ECE9E4' }}
                >
                  {link.title}
                </span>
                <span
                  className="text-sm font-sans"
                  style={{ color: 'rgba(236, 233, 228, 0.9)' }}
                >
                  {link.description}
                </span>
              </button>
            ) : (
              <a
                key={link.title}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-2.5 py-3.5 px-3 md:px-8 rounded-lg hover:bg-white/10 transition-colors"
              >
                <span
                  className="text-xl font-sans tracking-wide"
                  style={{ color: '#ECE9E4' }}
                >
                  {link.title}
                </span>
                <span
                  className="text-sm font-sans"
                  style={{ color: 'rgba(236, 233, 228, 0.9)' }}
                >
                  {link.description}
                </span>
              </a>
            )
          )}
        </div>
      </nav>

      {/* ─── 巨大化 HIMEMATSU Logo ─── */}
      <div className="w-full p-5 flex items-center justify-center">
        <Image
          src="/HIMEMATSU.svg"
          alt="HIMEMATSU"
          width={1844}
          height={260}
          className="w-full h-auto max-w-none opacity-90"
          priority={false}
        />
      </div>

      {/* ─── 次页脚版权信息 ─── */}
      <div
        className="w-full flex items-center justify-between px-6 md:px-[92px] py-[18px] text-sm font-sans"
        style={{ color: 'rgba(236, 233, 228, 0.9)' }}
      >
        <span className="text-base">
          Copyright © 2026 HIMEMATSU. All rights reserved.
        </span>
        <a
          href="https://beian.miit.gov.cn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm hover:underline"
        >
          湘ICP备2024093060号-2
        </a>
      </div>
    </footer>
  );
}
