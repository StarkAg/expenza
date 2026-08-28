'use client';

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import { usePendingLive } from '../hooks/usePendingLive';
import { hapticFeedback } from '../utils/haptics';
import { AddIcon, StatsIcon, SettingsIcon, TransactionsIcon, InboxIcon } from './Icons';

const navItems = [
  { href: '/stats', label: 'Stats', Icon: StatsIcon },
  { href: '/transactions', label: 'Transactions', Icon: TransactionsIcon },
  { href: '/add', label: 'Add', Icon: AddIcon },
  { href: '/inbox', label: 'Inbox', Icon: InboxIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { username } = useSupabase();

  // Live badge: pushed over a websocket when realtime is available, polled
  // otherwise. Either way it updates without a refresh.
  const { pendingCount } = usePendingLive(username);

  const handleClick = (href: string) => {
    hapticFeedback('light');

    // Use transition for smooth navigation
    startTransition(() => {
      // Clear edit data when clicking Add tab to ensure new entry
      if (href === '/add' && typeof window !== 'undefined') {
        sessionStorage.removeItem('editExpense');
      }
    router.push(href);
    });
  };

  return (
    <nav className="app-tab-bar fixed bottom-0 left-0 right-0 bg-white dark:bg-black backdrop-blur-xl border-t border-black/10 dark:border-white/10 pb-safe-bottom z-50" aria-label="Primary navigation">
      <div className="w-full max-w-md lg:max-w-2xl mx-auto flex justify-around items-center h-14 sm:h-16 px-2 sm:px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname === '/' && item.href === '/stats');
          const Icon = item.Icon;
          const showBadge = item.href === '/inbox' && pendingCount > 0;
          return (
            <button
              key={item.href}
              onClick={() => handleClick(item.href)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`app-tab-bar__item flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-0 ${
                item.href === '/add' ? 'app-tab-bar__add' : ''
              } ${
                isActive
                  ? 'text-black dark:text-white'
                  : 'text-black/40 dark:text-white/40'
              }`}
            >
              <span className="relative">
                <Icon className="mb-0.5 sm:mb-1" size={item.href === '/add' ? 24 : 20} />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] leading-none">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </span>
              <span className="text-ios-caption-1 text-xs sm:text-sm truncate w-full text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
