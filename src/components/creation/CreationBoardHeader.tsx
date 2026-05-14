export default function CreationBoardHeader() {
  return (
    <header className="w-full pt-12 pb-8 sm:pt-16 sm:pb-10 px-4 sm:px-6 lg:px-10 text-center">
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-ink-strong tracking-wider mb-3">
        创作公示板
      </h1>
      <p className="text-ink-muted text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
        这里收集群友灵感，欢迎在已有灵感上继续扩写与衍生，或者{' '}
        <a
          href="https://himematsu.feishu.cn/share/base/form/shrcnvH1XbegEynR58DUVPsPSWh"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap shrink-0
                     border border-black/[0.08] bg-white/92 px-3 py-1.5
                     text-[11px] leading-none text-ink
                     shadow-[0_2px_6px_rgba(69,39,40,0.08)]
                     transition-colors duration-150 hover:bg-white"
          style={{ borderRadius: 0 }}
        >
          <span className="text-[12px] leading-none">+</span>
          <span>新建卡片</span>
        </a>
        {' '}创建一个新的故事
      </p>
      {/* 分隔 — 克制的细线 */}
      <div className="mt-6 mx-auto w-16 h-px bg-ink-muted/30" />
    </header>
  );
}
