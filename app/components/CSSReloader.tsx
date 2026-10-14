'use client';

import { useEffect } from 'react';

/**
 * Last-resort recovery for a page that painted without its stylesheet.
 *
 * This existed to paper over the old service worker handing back a stale or
 * truncated CSS response. That cause is gone -- `/_next/static/**` is now
 * content-hashed and cache-first, so a hit is always the right bytes -- but
 * a genuinely failed stylesheet request is still possible on a flaky
 * connection, so the re-link stays.
 *
 * What is deliberately gone is the `window.location.reload()` this used to
 * fall back to. The heuristic below can false-positive, and a reload
 * triggered while someone is part-way through entering an expense costs them
 * their input. Re-linking is idempotent and safe; reloading is not.
 */
export default function CSSReloader() {
  useEffect(() => {
    const stylesheetsLoaded = () => {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
      );
      if (links.length === 0) return true; // styles are inlined; nothing to check

      // A <link> that failed leaves no entry in document.styleSheets.
      const hrefs = new Set(
        Array.from(document.styleSheets)
          .map((sheet) => sheet.href)
          .filter(Boolean) as string[]
      );
      return links.every((link) => !link.href || hrefs.has(link.href));
    };

    const timeoutId = setTimeout(() => {
      if (stylesheetsLoaded()) return;

      console.warn('[Expenza] a stylesheet failed to load; re-requesting it');
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        const separator = href.includes('?') ? '&' : '?';
        link.setAttribute('href', `${href}${separator}_retry=${Date.now()}`);
      });
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, []);

  return null;
}
