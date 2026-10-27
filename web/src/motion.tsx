import { useEffect, useRef, useState, type CSSProperties, type ElementType, type PointerEvent, type ReactNode } from "react";

/**
 * Motion helpers. Everything here is decoration: content is readable without it, and it all
 * switches off when someone asks their device for reduced motion.
 */
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(margin = "0px 0px -10% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    if (reducedMotion() || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen, margin]);
  return [ref, seen] as const;
}

/** Fades and lifts its children in when they scroll into view. `delay` staggers siblings. */
export function Reveal({ as: Tag = "div", delay = 0, className, children, ...rest }: { as?: ElementType; delay?: number; className?: string; children: ReactNode; [key: string]: unknown }) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <Tag ref={ref} className={className ? `reveal ${className}` : "reveal"} data-shown={seen ? "" : undefined} style={{ "--delay": `${delay}ms` } as CSSProperties} {...rest}>
      {children}
    </Tag>
  );
}

/** Counts from 0 to `target` once `start` is true. */
export function useCountUp(target: number, start: boolean, duration = 1100): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (reducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, start, duration]);
  return value;
}

/** A percentage that counts up when it scrolls into view. */
export function CountUp({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const shown = useCountUp(value, seen);
  return (
    <span ref={ref} className="count-up">
      {/* Screen readers get the final number at once. */}
      <span aria-hidden="true">
        {Math.round(shown)}
        {suffix}
      </span>
      <span className="visually-hidden">
        {value}
        {suffix}
      </span>
    </span>
  );
}

/**
 * Pointer position over an element as CSS variables --px and --py (-1 to 1), for tilt and parallax.
 * Only for fine pointers; touch screens keep things still.
 */
export function usePointerVars<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const onPointerMove = (event: PointerEvent<T>) => {
    if (event.pointerType !== "mouse" || reducedMotion()) return;
    const element = ref.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    element.style.setProperty("--px", (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
    element.style.setProperty("--py", (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
  };
  const onPointerLeave = () => {
    ref.current?.style.setProperty("--px", "0");
    ref.current?.style.setProperty("--py", "0");
  };
  return { ref, onPointerMove, onPointerLeave };
}

/** A card that tilts gently toward the pointer. */
export function Tilt({ as: Tag = "div", className, children, ...rest }: { as?: ElementType; className?: string; children: ReactNode; [key: string]: unknown }) {
  const pointer = usePointerVars<HTMLElement>();
  return (
    <Tag {...rest} ref={pointer.ref} onPointerMove={pointer.onPointerMove} onPointerLeave={pointer.onPointerLeave} className={className ? `tilt ${className}` : "tilt"}>
      {children}
    </Tag>
  );
}
