'use client';

import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/': 'Overview',
  '/stats': 'Overview',
  '/transactions': 'Activity',
  '/add': 'Add expense',
  '/inbox': 'Inbox',
  '/settings': 'Settings',
  '/accounts': 'Accounts',
  '/fixed-expenses': 'Bills',
  '/printer': 'Printer',
  '/settings/auto-tracker': 'Auto-tracker',
};

export default function MobileAppHeader() {
  const pathname = usePathname();

  if (pathname === '/auth') return null;

  const title = pageTitles[pathname] ?? 'Expenza';

  return (
    <header className="mobile-app-header lg:hidden" aria-label="Expenza app header">
      <div className="mobile-app-header__content">
        {/* eslint-disable-next-line @next/next/no-img-element -- static PWA mark is already a 192px local asset */}
        <img className="mobile-app-header__logo" src="/icon-192.png" alt="" aria-hidden="true" />
        <div className="min-w-0">
          <p className="mobile-app-header__brand">EXPENZA</p>
          <p className="mobile-app-header__title">{title}</p>
        </div>
      </div>
    </header>
  );
}
