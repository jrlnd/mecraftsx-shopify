import Lenis from '@theme/lenis';
import { getScrollContainer, scrollContainerMediaQuery } from '@theme/scroll-container';

/**
 * Smooths mouse-wheel scrolling of the page with Lenis.
 *
 * The page scroll container changes with the viewport (`.page-wrapper` on desktop, the document
 * on mobile), so Lenis is rebuilt whenever that switches. Touch scrolling stays native, Lenis
 * turns itself off for `prefers-reduced-motion`, and it pauses while the theme scroll-locks
 * the page for a modal or drawer.
 */

const REDUCED_MOTION_QUERY = window.matchMedia('(prefers-reduced-motion: reduce)');

/** @type {Lenis | undefined} */
let lenis;

/**
 * Wheel events inside these elements scroll them natively instead of the page.
 *
 * @param {HTMLElement} node
 * @returns {boolean}
 */
function preventSmoothScroll(node) {
  return node.matches('dialog, [popover]');
}

function syncScrollLock() {
  if (!lenis) return;

  if (document.documentElement.hasAttribute('scroll-lock')) {
    lenis.stop();
  } else {
    lenis.start();
  }
}

function createLenis() {
  lenis?.destroy();
  lenis = undefined;

  if (REDUCED_MOTION_QUERY.matches) return;

  const container = getScrollContainer();
  const isDocument = container === document.scrollingElement || container === document.documentElement;

  if (isDocument) {
    lenis = new Lenis({ autoRaf: true, allowNestedScroll: true, prevent: preventSmoothScroll });
  } else if (container instanceof HTMLElement) {
    // `.page-wrapper` has a fixed height, so a cached scroll length goes stale whenever the header
    // group, main content or footer grow after load. Read the live length instead.
    lenis = new Lenis({
      wrapper: container,
      naiveDimensions: true,
      autoRaf: true,
      allowNestedScroll: true,
      prevent: preventSmoothScroll,
    });
  }

  syncScrollLock();
}

new MutationObserver(syncScrollLock).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['scroll-lock'],
});

scrollContainerMediaQuery.addEventListener('change', createLenis);
REDUCED_MOTION_QUERY.addEventListener('change', createLenis);

createLenis();
