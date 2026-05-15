import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { GlobalNav } from "@/components/shared/GlobalNav";
import { TransitionOverlay } from "@/components/shared/TransitionOverlay";
import { FeishuDocModal } from "@/components/shared/FeishuDocModal";
import { StickyCursor } from "@/components/motion/StickyCursor";
import { ContentStoreProvider } from "@/lib/content-store";
import { FEISHU_SDK_URL } from "@/lib/announcement-prefetch";

const displayFont = localFont({
  src: "../../public/ChillDINGothic_SemiBold.otf",
  variable: "--font-display",
  display: "swap",
  fallback: ["PingFang SC", "Microsoft YaHei", "sans-serif"],
});

const bodyFont = localFont({
  src: "../../public/ZouLDFXKAJ.ttf",
  variable: "--font-body",
  display: "swap",
  fallback: ["PingFang SC", "Microsoft YaHei", "sans-serif"],
});

export const metadata: Metadata = {
  title: "与她的海大时光笺 | HNU-TimeLetter",
  description: "基于海南大学校园地图的交互式视觉叙事网站，展示 Galgame 角色与校园实景结合的决定性瞬间",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/*
         * 关键路径图标预加载 —— 浏览器解析 HTML 时以最高优先级并行下载，
         * 消除开屏首帧渲染前的网络等待延迟。
         */}
        <link rel="preload" as="image" href="/HIMEMATSU.svg" fetchPriority="high" />
        {/*
         * 飞书公告弹窗资源预热 —— 在 HTML 解析阶段就建立 TLS 连接并预下载 SDK 脚本，
         * 大幅缩短用户点击「公告」后到飞书云文档可见的端到端延迟。
         * 详见 src/lib/announcement-prefetch.ts。
         */}
        <link rel="dns-prefetch" href="//sf1-scmcdn-cn.feishucdn.com" />
        <link rel="dns-prefetch" href="//himematsu.feishu.cn" />
        <link rel="preconnect" href="https://sf1-scmcdn-cn.feishucdn.com" />
        <link rel="preconnect" href="https://himematsu.feishu.cn" />
        <link rel="preload" as="script" href={FEISHU_SDK_URL} />
        {/*
         * 开屏滚动锁定内联脚本 —— 在任何 JS bundle 执行、React hydration
         * 发生之前同步运行，从首字节即锁住纵向滚动，消除 useEffect 延迟窗口。
         * 此时 document.body 尚未解析，仅操作已存在的 <html> 元素。
         * React 侧的 useEffect 在 hydration 后同步追加 body 上同名类，
         * 两者合力保证全程无滚动泄漏。
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: "if(window.location.pathname==='/')document.documentElement.classList.add('intro-scroll-locked');",
          }}
        />
      </head>
      <body
        className={`${displayFont.variable} ${bodyFont.variable} font-sans antialiased`}
      >
        {/*
         * 站点级画框容器 —— docs/design/全站视口画框.md §4.1
         * children / GlobalNav / TransitionOverlay 统一挂在 shell 内，
         * 任何需要「视口全屏」的层以 shell 为参照而非浏览器物理边缘。
         */}
        <div className="site-frame-shell">
          <ContentStoreProvider>
            {children}
            <GlobalNav />
            <TransitionOverlay />
            <FeishuDocModal />
          </ContentStoreProvider>
        </div>
        {/*
          * 高阶延迟追踪光标（Sticky Cursor）
          * 挂载于 body 顶层，position: fixed / pointer-events: none / z-index 置顶。
          * 在 window 级别追踪鼠标坐标并写入 MotionValue（内存变量），
          * 通过 useSpring 的分层 damping 产生粘稠延迟追踪效果。
          */}
        <StickyCursor />
        {/*
          * 画框描边层 —— 置于视口最顶层，z-index 高于一切全屏遮罩，
          * 使 5px #fffdfd 白边在页面切换、过渡、模态、加载态下始终可见。
          * pointer-events:none 穿透点击，不影响交互。
          */}
        <div className="site-frame-border" aria-hidden />
      </body>
    </html>
  );
}
