import { gsap, registerGsap } from "./register";
import { REDUCED_MOTION_QUERY } from "./tokens";

/**
 * A small ghost of `from` flies to `to` and fades: the "item went into the
 * cart" cue. 220 ms, so it never slows scan-to-cart. Reduced motion: nothing.
 */
export function flyTo(from: Element | null, to: Element | null) {
  if (!from || !to || typeof window === "undefined") return;
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
  registerGsap();

  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const ghost = from.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "80",
    transformOrigin: "center",
  });
  ghost.setAttribute("aria-hidden", "true");
  document.body.appendChild(ghost);

  gsap.to(ghost, {
    x: b.left + b.width / 2 - (a.left + a.width / 2),
    y: b.top + b.height / 2 - (a.top + a.height / 2),
    scale: 0.25,
    opacity: 0.2,
    duration: 0.22,
    ease: "power2.in",
    onComplete: () => ghost.remove(),
  });
}
