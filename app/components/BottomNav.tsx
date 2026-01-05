'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { hapticFeedback } from '../utils/haptics';
import { HomeIcon, AddIcon, StatsIcon, SettingsIcon, TransactionsIcon } from './Icons';

const navItems = [
  { href: '/', label: 'Stats', Icon: StatsIcon },
  { href: '/transactions', label: 'Transactions', Icon: TransactionsIcon },
  { href: '/add', label: 'Add', Icon: AddIcon },
  { href: '/stats', label: 'Home', Icon: HomeIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = (href: string) => {
    hapticFeedback('light');
    // Clear edit data when clicking Add tab to ensure new entry
    if (href === '/add' && typeof window !== 'undefined') {
      sessionStorage.removeItem('editExpense');
    }
    router.push(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black backdrop-blur-xl border-t border-black/10 dark:border-white/10 pb-safe-bottom z-50">
      <div className="w-full max-w-md lg:max-w-2xl mx-auto flex justify-around items-center h-14 sm:h-16 px-2 sm:px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.Icon;
          return (
            <button
              key={item.href}
              onClick={() => handleClick(item.href)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-0 ${
                isActive
                  ? 'text-black dark:text-white'
                  : 'text-black/40 dark:text-white/40'
              }`}
            >
              <Icon className="mb-0.5 sm:mb-1" size={20} />
              <span className="text-ios-caption-1 text-xs sm:text-sm truncate w-full text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

