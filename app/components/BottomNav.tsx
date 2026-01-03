'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { hapticFeedback } from '../utils/haptics';

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/add', label: 'Add', icon: '➕' },
  { href: '/stats', label: 'Stats', icon: '📊' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = (href: string) => {
    hapticFeedback('light');
    router.push(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-ios-gray-900/80 backdrop-blur-xl border-t border-ios-gray-200 dark:border-ios-gray-800 pb-safe-bottom">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => handleClick(item.href)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-ios-blue dark:text-ios-blue'
                  : 'text-ios-gray-600 dark:text-ios-gray-400'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-ios-caption-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

