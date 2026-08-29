'use client';

import { useRouter } from 'next/navigation';
import BottomNav from '../../../components/BottomNav';
import { hapticFeedback } from '../../../utils/haptics';

const steps = [
  {
    number: '01',
    title: 'Create your connection',
    body: 'Go back to Auto-Tracking and tap Create Auto-Tracking link. Expenza gives your account one reusable Shortcut URL that stays available there.',
  },
  {
    number: '02',
    title: 'Make a personal automation',
    body: 'Open Shortcuts, tap Automation, tap +, then choose Create Personal Automation. Select Message and choose the senders or keywords you want to track.',
  },
  {
    number: '03',
    title: 'Add the web request',
    body: 'Add the Get Contents of URL action. Paste the Shortcut URL from Expenza into its URL field.',
  },
  {
    number: '04',
    title: 'Send the message text',
    body: 'In Get Contents of URL, set Method to POST. Set Request Body to Text, then insert the Message variable as the body.',
  },
  {
    number: '05',
    title: 'Run automatically',
    body: 'Turn off Ask Before Running, confirm Don’t Ask, and save. The next matching bank message will be sent to your Expenza inbox for review.',
  },
];

export default function IPhoneShortcutGuidePage() {
  const router = useRouter();

  const goToSetup = () => {
    hapticFeedback('light');
    router.push('/settings/auto-tracker');
  };

  return (
    <div className="iphone-guide-screen flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-6 pt-4 pb-32 sm:pb-36">
          <button type="button" onClick={goToSetup} className="iphone-guide__back mb-5">
            <span aria-hidden="true">←</span> Auto-Tracking
          </button>

          <p className="iphone-guide__eyebrow">IPHONE SHORTCUTS</p>
          <h1 className="text-ios-title-2 text-black dark:text-white mb-2">Turn bank messages into expenses.</h1>
          <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mb-6">
            This takes about two minutes. Your bank message is sent securely to Expenza, then appears in your inbox for approval.
          </p>

          <section className="iphone-guide__notice mb-6 p-4 rounded-ios-lg" aria-label="Before you begin">
            <p className="iphone-guide__notice-title">Before you begin</p>
            <p className="iphone-guide__notice-copy">
              You need the Apple Shortcuts app and an active Expenza connection. Create the connection first so you have your personal Shortcut URL.
            </p>
          </section>

          <ol className="iphone-guide__steps space-y-3">
            {steps.map((step) => (
              <li key={step.number} className="iphone-guide__step p-4 rounded-ios-lg">
                <span className="iphone-guide__number">{step.number}</span>
                <div>
                  <h2 className="text-ios-body font-semibold text-black dark:text-white mb-1">{step.title}</h2>
                  <p className="text-ios-caption-1 text-black/60 dark:text-white/60">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <section className="iphone-guide__tip mt-6 p-4 rounded-ios-lg">
            <p className="iphone-guide__tip-title">Privacy note</p>
            <p className="text-ios-caption-1 text-black/60 dark:text-white/60">
              Your Shortcut URL is personal. Do not share it. You can revoke and replace the account link at any time from Auto-Tracking.
            </p>
          </section>

          <button type="button" onClick={goToSetup} className="iphone-guide__cta w-full mt-6 py-3 rounded-ios-lg text-ios-headline">
            Open Auto-Tracking
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
