// Minimal CSS-only zoom entrance animation (§6 of
// `dev-plan/interaction-design-framework/03-zoom-navigation.md`). Whenever
// the `levelKey` changes the wrapper mounts its child with a slight scale
// + fade and settles on the next animation frame. Polish (crossfade,
// spring physics) is deferred to Phase 7.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export interface ZoomTransitionProps {
  levelKey: string;
  children: ReactNode;
  /** Transition duration in milliseconds. Defaults to 200ms per spec. */
  durationMs?: number;
}

export function ZoomTransition(props: ZoomTransitionProps): JSX.Element {
  const { levelKey, children, durationMs = 200 } = props;
  const [entered, setEntered] = useState(false);
  const previousKey = useRef<string | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (previousKey.current === levelKey) return;
    previousKey.current = levelKey;
    setEntered(false);
    // Two rAFs: the first commits the "pre" frame so the browser registers
    // the starting transform before we transition to the resting state.
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [levelKey]);

  const style: CSSProperties = {
    transitionProperty: "opacity, transform",
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    opacity: entered ? 1 : 0,
    transform: entered ? "scale(1)" : "scale(1.02)",
    willChange: "opacity, transform",
    height: "100%",
    width: "100%",
  };

  return (
    <div
      key={levelKey}
      data-zoom-level-key={levelKey}
      className="sc-zoom-transition h-full w-full"
      style={style}
    >
      {children}
    </div>
  );
}
