'use client';

import Image from 'next/image';

export default function DevCredits() {
  return (
    <div className="pt-4 pb-4">
      <div className="bg-black dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4">
        <div className="flex items-center justify-between">
          {/* Left side: Text stacked vertically */}
          <div className="flex flex-col">
            <span className="text-ios-caption-1 text-white/60 dark:text-white/60 uppercase tracking-wider font-medium">
              BY STARK
            </span>
            <span className="text-ios-caption-1 text-white/60 dark:text-white/60 uppercase tracking-wider font-medium">
              HARSH
            </span>
          </div>

          {/* Right side: Three square icons with rounded corners */}
          <div className="flex items-center gap-2">
            {/* GitHub Icon - Square with rounded corners, outline style */}
            <a
              href="https://github.com/StarkAg"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-lg border border-white/20 dark:border-white/20 flex items-center justify-center bg-transparent hover:bg-white/5 active:opacity-70 transition-colors"
              aria-label="GitHub"
            >
              <Image
                src="/DevCredits/github-logo.svg"
                alt="GitHub"
                width={18}
                height={18}
                className="opacity-60 dark:opacity-60 brightness-0 dark:brightness-0 invert dark:invert"
              />
            </a>

            {/* LinkedIn Icon - Square with rounded corners, outline style */}
            <a
              href="https://www.linkedin.com/in/harshxagarwal"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-lg border border-white/20 dark:border-white/20 flex items-center justify-center bg-transparent hover:bg-white/5 active:opacity-70 transition-colors"
              aria-label="LinkedIn"
            >
              <Image
                src="/DevCredits/linkedin-logo.png"
                alt="LinkedIn"
                width={18}
                height={18}
                className="opacity-60 dark:opacity-60 brightness-0 dark:brightness-0 invert dark:invert"
              />
            </a>

            {/* Sun Icon - Square with rounded corners, white outline (brighter) */}
            <button
              type="button"
              className="w-10 h-10 rounded-lg border border-white/40 dark:border-white/40 flex items-center justify-center bg-transparent hover:bg-white/5 active:opacity-70 transition-colors"
              aria-label="Theme"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="M4.93 4.93l1.41 1.41" />
                <path d="M17.66 17.66l1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="M4.93 19.07l1.41-1.41" />
                <path d="M17.66 6.34l1.41-1.41" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

