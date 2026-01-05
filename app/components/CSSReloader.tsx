'use client';

import { useEffect } from 'react';

/**
 * Component to detect and fix missing CSS issues
 * Checks if CSS is loaded properly and reloads if needed
 */
export default function CSSReloader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Function to check if CSS is loaded
    const checkCSS = () => {
      // Check if any stylesheets are loaded
      const stylesheets = Array.from(document.styleSheets);
      let hasValidCSS = false;

      try {
        // Try to access a stylesheet rule to verify CSS is loaded
        for (const sheet of stylesheets) {
          try {
            if (sheet.cssRules && sheet.cssRules.length > 0) {
              hasValidCSS = true;
              break;
            }
          } catch (e) {
            // Cross-origin stylesheet, skip
            continue;
          }
        }
      } catch (e) {
        // Error accessing stylesheets
      }

      // Check if computed styles are working (verify CSS is actually applied)
      const testElement = document.createElement('div');
      testElement.style.position = 'absolute';
      testElement.style.visibility = 'hidden';
      testElement.className = 'font-sans'; // Should be defined in Tailwind
      document.body.appendChild(testElement);
      
      const computedStyle = window.getComputedStyle(testElement);
      const fontFamily = computedStyle.fontFamily;
      document.body.removeChild(testElement);

      // If font-family is not set or is default, CSS might not be loaded
      if (!fontFamily || fontFamily === 'serif' || fontFamily === '') {
        hasValidCSS = false;
      }

      return hasValidCSS;
    };

    // Check CSS after a short delay to allow initial load
    const timeoutId = setTimeout(() => {
      if (!checkCSS()) {
        console.warn('CSS not detected, attempting to reload...');
        
        // Try to reload CSS by finding and reloading stylesheet links
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        links.forEach((link) => {
          const href = link.getAttribute('href');
          if (href) {
            // Force reload by adding timestamp
            const newHref = href.includes('?') 
              ? `${href}&_reload=${Date.now()}` 
              : `${href}?_reload=${Date.now()}`;
            link.setAttribute('href', newHref);
          }
        });

        // If still no CSS after reload attempt, reload the page
        setTimeout(() => {
          if (!checkCSS()) {
            console.warn('CSS still not loaded, reloading page...');
            window.location.reload();
          }
        }, 2000);
      }
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  return null;
}

