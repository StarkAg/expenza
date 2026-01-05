'use client';

import BottomNav from '../components/BottomNav';

export default function StatsPage() {
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-2 sm:px-3 md:px-4 lg:px-4 pt-3 sm:pt-4 md:pt-6 pb-20 sm:pb-24">
          <h1 className="text-ios-large-title text-black dark:text-white mb-4 sm:mb-6">
            Home
          </h1>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
