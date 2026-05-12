'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/admin/dashboard', label: '控制台 (Dashboard)' },
  { href: '/admin/content', label: '内容数据 (Content)' },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/admin/login', { method: 'DELETE' });
    } finally {
      router.push('/admin/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white shadow-md flex flex-col fixed h-full z-10">
        <div className="p-6 border-b">
          <h1 className="mb-0 text-xl font-bold">与她的海大时光笺</h1>
          <p className="text-xs text-gray-500 mt-1">后台管理系统</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 rounded transition-colors text-sm ${
                  isActive
                    ? 'bg-gray-900 text-white font-medium'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t space-y-2">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 block">
            返回前台
          </Link>
          <button
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 block w-full text-left"
          >
            {loggingOut ? '退出中...' : '退出登录'}
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
