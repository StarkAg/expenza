export function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
  if (typeof window === 'undefined') return;

  // Check if device supports haptics
  if ('vibrate' in navigator) {
    const patterns: Record<string, number | number[]> = {
      light: 10,
      medium: 20,
      heavy: 30,
    };
    navigator.vibrate(patterns[type]);
  }
}

