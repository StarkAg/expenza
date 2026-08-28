'use client';

export default function DesktopHeader() {
  // Visibility is CSS-driven so the server and browser produce identical
  // markup during hydration. Rendering conditionally on `window` here made
  // every route fail hydration before the responsive class could hide it.
  return (
    <header className="hidden lg:block fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-black/10 dark:border-white/10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-center">
        <h1 className="text-lg font-semibold tracking-wide text-black dark:text-white">
          Expenza
        </h1>
      </div>
    </header>
  );
}
