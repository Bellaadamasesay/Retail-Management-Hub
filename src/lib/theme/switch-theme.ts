import { flushSync } from "react-dom";
import { REDUCED_MOTION_QUERY } from "@/lib/motion/tokens";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

/**
 * Applies a theme change inside a View Transition so light and dark crossfade
 * instead of snapping. Falls back to an instant switch when the browser has no
 * View Transitions or the user prefers reduced motion.
 */
export function switchTheme(setTheme: (value: string) => void, value: string) {
  const doc = document as ViewTransitionDocument;
  const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  if (reduced || !doc.startViewTransition) {
    setTheme(value);
    return;
  }
  doc.startViewTransition(() => {
    flushSync(() => setTheme(value));
  });
}
