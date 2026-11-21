import { AccessibilityInfo } from 'react-native';

let reduceMotion = false;

AccessibilityInfo.isReduceMotionEnabled?.()
  ?.then((enabled) => {
    reduceMotion = enabled;
  })
  .catch(() => undefined);

AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
  reduceMotion = enabled;
});

// Animations collapse to an instant change when the system asks for reduced motion.
export function motionDuration(ms: number) {
  return reduceMotion ? 0 : ms;
}
