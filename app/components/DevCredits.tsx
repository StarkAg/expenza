'use client';

import Image from 'next/image';

export default function DevCredits() {
  return (
    <div className="pt-4 pb-4">
      <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4">
        <p className="text-ios-caption-1 text-black/60 dark:text-white/60 text-center mb-3">
          DevCredits
        </p>
        <p className="text-ios-caption-1 text-black/50 dark:text-white/50 text-center mb-4">
          Built with Next.js, React, Tailwind CSS, and Supabase
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://github.com/StarkAg"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white active:opacity-70 transition-colors"
            aria-label="GitHub"
          >
            <Image
              src="/DevCredits/github-logo.svg"
              alt="GitHub"
              width={24}
              height={24}
              className="dark:invert"
            />
            <span className="text-ios-caption-1">GitHub</span>
          </a>
          <a
            href="https://www.linkedin.com/in/harshxagarwal"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white active:opacity-70 transition-colors"
            aria-label="LinkedIn"
          >
            <Image
              src="/DevCredits/linkedin-logo.png"
              alt="LinkedIn"
              width={24}
              height={24}
            />
            <span className="text-ios-caption-1">LinkedIn</span>
          </a>
        </div>
      </div>
    </div>
  );
}

