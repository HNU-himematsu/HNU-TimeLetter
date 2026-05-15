import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-serif text-foreground mb-4">404</h1>
        <p className="text-xl text-muted mb-8">页面未找到</p>
        <Link 
          href="/"
          className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
