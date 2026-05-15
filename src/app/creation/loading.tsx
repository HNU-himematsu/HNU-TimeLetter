export default function CreationLoading() {
  return (
    <div className="relative min-h-dvh bg-background">
      {/* 网格草稿线背景 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10">
        {/* 标题骨架 */}
        <header className="w-full pt-12 pb-8 sm:pt-16 sm:pb-10 px-4 text-center">
          <div className="mx-auto h-10 w-48 bg-paper-strong/60 animate-pulse" />
          <div className="mx-auto mt-3 h-4 w-72 bg-paper-strong/40 animate-pulse" />
          <div className="mt-6 mx-auto w-16 h-px bg-ink-muted/30" />
        </header>

        {/* 卡片骨架 — 纸面占位 */}
        <div className="px-4 sm:px-6 lg:px-10 columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="break-inside-avoid mb-5 animate-pulse"
              style={{
                backgroundColor: '#f2ece6',
                height: `${120 + (i % 3) * 60}px`,
                borderRadius: 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
