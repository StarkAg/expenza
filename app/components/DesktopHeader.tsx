'use client';

export default function DesktopHeader() {
  if (typeof window === 'undefined') return null;

  // Only show on larger screens (tailwind breakpoint md+ handles this)
  return (
    <header className="hidden md:block fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-black/10 dark:border-white/10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-center">
        <h1 className="text-lg font-semibold tracking-wide text-black dark:text-white">
          Expenza
        </h1>
      </div>
    </header>
  );
}


