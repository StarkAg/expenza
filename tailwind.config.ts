import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // iOS-style colors
        ios: {
          blue: '#007AFF',
          green: '#34C759',
          indigo: '#5856D6',
          orange: '#FF9500',
          pink: '#FF2D55',
          purple: '#AF52DE',
          red: '#FF3B30',
          teal: '#5AC8FA',
          yellow: '#FFCC00',
          gray: {
            50: '#F9F9F9',
            100: '#F2F2F7',
            200: '#E5E5EA',
            300: '#D1D1D6',
            400: '#C7C7CC',
            500: '#AEAEB2',
            600: '#8E8E93',
            700: '#636366',
            800: '#48484A',
            900: '#1C1C1E',
          },
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // iOS typography scale
        'ios-large-title': ['34px', { lineHeight: '41px', fontWeight: '700' }],
        'ios-title-1': ['28px', { lineHeight: '34px', fontWeight: '700' }],
        'ios-title-2': ['22px', { lineHeight: '28px', fontWeight: '700' }],
        'ios-title-3': ['20px', { lineHeight: '25px', fontWeight: '600' }],
        'ios-headline': ['17px', { lineHeight: '22px', fontWeight: '600' }],
        'ios-body': ['17px', { lineHeight: '22px', fontWeight: '400' }],
        'ios-callout': ['16px', { lineHeight: '21px', fontWeight: '400' }],
        'ios-subhead': ['15px', { lineHeight: '20px', fontWeight: '400' }],
        'ios-footnote': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'ios-caption-1': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'ios-caption-2': ['11px', { lineHeight: '13px', fontWeight: '400' }],
      },
      spacing: {
        // iOS spacing scale
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      borderRadius: {
        ios: '10px',
        'ios-lg': '14px',
      },
      boxShadow: {
        ios: '0 2px 8px rgba(0, 0, 0, 0.15)',
        'ios-lg': '0 4px 16px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
};

export default config;


