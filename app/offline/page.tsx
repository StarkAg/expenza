import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline - Expenza',
};

/* Served by the service worker when a navigation cannot reach the network.
 * Styles are inline: the hashed CSS bundle may not be in the cache on the
 * very first offline launch, and this screen has to render regardless. */
export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: 'calc(env(safe-area-inset-top, 0px) + 2rem) 1.5rem calc(env(safe-area-inset-bottom, 0px) + 2rem)',
        background: '#080808',
        color: '#f5f5f2',
        textAlign: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- precached local asset, no loader available offline */}
      <img
        src="/icon-192.png"
        alt=""
        aria-hidden="true"
        width={64}
        height={64}
        style={{ borderRadius: '1.125rem', boxShadow: '0 7px 18px rgb(0 0 0 / 0.48)' }}
      />
      <p style={{ margin: 0, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.14em', color: '#d6923c' }}>
        EXPENZA
      </p>
      <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 700 }}>You&rsquo;re offline</h1>
      <p style={{ margin: 0, maxWidth: '22rem', fontSize: '0.9375rem', lineHeight: 1.5, color: 'rgb(245 245 242 / 0.6)' }}>
        Expenza will pick up where you left off as soon as the connection is
        back. Anything you saved offline is still queued.
      </p>
    </div>
  );
}
