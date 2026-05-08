import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { GlobalNav } from "@/components/shared/GlobalNav";
import { TransitionOverlay } from "@/components/shared/TransitionOverlay";
import { ContentStoreProvider } from "@/lib/content-store";

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
         * 开屏滚动锁定内联脚本 —— 在任何 JS bundle 执行、React hydration
         * 发生之前同步运行，从首字节即锁住纵向滚动，消除 useEffect 延迟窗口。
         * 此时 document.body 尚未解析，仅操作已存在的 <html> 元素。
         * React 侧的 useEffect 在 hydration 后同步追加 body 上同名类，
         * 两者合力保证全程无滚动泄漏。
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('intro-scroll-locked');",
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
          </ContentStoreProvider>
        </div>
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
