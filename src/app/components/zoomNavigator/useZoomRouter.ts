// React bindings for the Zoom Navigator (§5 of
// `dev-plan/interaction-design-framework/03-zoom-navigation.md`). The
// provider is deliberately self-contained: it holds the level + history
// stack in local state and never touches `useEditorBackend()` or backend
// reducers. A Phase 6 adapter can mirror state into
// `ProjectSnapshotV2.zoomLevel` via the `initialLevel` + `onLevelChange`
// hooks.

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NavigationZoomLevel } from "../../backend/types/zoomLevel";
import type { NavMapViewport } from "../../backend/types/navigationMap";
import type { NavMapSelection } from "../../backend/types/navMapSelection";
import {
  peekContext,
  popContext,
  pushContext,
  replaceTopContext,
  type BoardCamera,
  type ZoomContext,
} from "./contextStack";

export interface ZoomRouterValue {
  current: NavigationZoomLevel;
  canGoBack: boolean;
  stackDepth: number;
  zoomInto(stateNodeId: string, opts?: { variantId?: string; snapshot?: Partial<ZoomContext> }): void;
  zoomOut(): void;
  goToMap(): void;
  replaceVariant(variantId: string): void;
  rememberNavViewport(viewport: NavMapViewport): void;
  rememberNavSelection(selection: NavMapSelection): void;
  rememberBoardCamera(camera: BoardCamera): void;
}

export interface ZoomRouterProviderProps {
  initialLevel?: NavigationZoomLevel;
  defaultVariantFor?(stateNodeId: string): string | undefined;
  onLevelChange?(level: NavigationZoomLevel): void;
  children: ReactNode;
}

const MAP_LEVEL: NavigationZoomLevel = { level: "map" };

export const ZoomRouterContext = createContext<ZoomRouterValue | null>(null);

/** Provider for Zoom Navigator state. See §5-6 of 03-zoom-navigation.md. */
export function ZoomRouterProvider(props: ZoomRouterProviderProps): JSX.Element {
  const { initialLevel, defaultVariantFor, onLevelChange, children } = props;
  const [current, setCurrent] = useState<NavigationZoomLevel>(initialLevel ?? MAP_LEVEL);
  const [stack, setStack] = useState<ZoomContext[]>([]);

  // Refs keep callbacks stable while still reading the latest inputs.
  const currentRef = useRef(current);
  currentRef.current = current;
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const onLevelChangeRef = useRef(onLevelChange);
  onLevelChangeRef.current = onLevelChange;
  const defaultVariantRef = useRef(defaultVariantFor);
  defaultVariantRef.current = defaultVariantFor;

  const emit = useCallback((next: NavigationZoomLevel) => {
    onLevelChangeRef.current?.(next);
  }, []);

  const zoomInto = useCallback<ZoomRouterValue["zoomInto"]>((stateNodeId, opts) => {
    const resolved = opts?.variantId ?? defaultVariantRef.current?.(stateNodeId) ?? "";
    if (!resolved) {
      // Only allowed console.warn per module spec.
      console.warn(`[ZoomRouter] zoomInto("${stateNodeId}") ignored: no variantId could be resolved.`);
      return;
    }
    const existingTop = peekContext(stackRef.current);
    const commit: ZoomContext = {
      ...(existingTop ?? { level: currentRef.current }),
      ...(opts?.snapshot ?? {}),
      level: currentRef.current,
    };
    const nextStack = existingTop
      ? replaceTopContext(stackRef.current, () => commit)
      : pushContext(stackRef.current, commit);
    const nextLevel: NavigationZoomLevel = { level: "board", stateNodeId, variantId: resolved };
    setStack(nextStack);
    setCurrent(nextLevel);
    emit(nextLevel);
  }, [emit]);

  const zoomOut = useCallback(() => {
    const { ctx, next } = popContext(stackRef.current);
    const nextLevel: NavigationZoomLevel = ctx?.level ?? MAP_LEVEL;
    setStack(next);
    setCurrent(nextLevel);
    emit(nextLevel);
  }, [emit]);

  const goToMap = useCallback(() => {
    setStack([]);
    setCurrent(MAP_LEVEL);
    emit(MAP_LEVEL);
  }, [emit]);

  const replaceVariant = useCallback<ZoomRouterValue["replaceVariant"]>((variantId) => {
    const cur = currentRef.current;
    if (cur.level !== "board") return;
    const nextLevel: NavigationZoomLevel = { level: "board", stateNodeId: cur.stateNodeId, variantId };
    setCurrent(nextLevel);
    emit(nextLevel);
  }, [emit]);

  const writeTop = useCallback((patch: Partial<ZoomContext>) => {
    setStack((prev) =>
      prev.length === 0
        ? [{ level: MAP_LEVEL, ...patch }]
        : replaceTopContext(prev, (top) => ({ ...top, ...patch })),
    );
  }, []);

  const rememberNavViewport = useCallback<ZoomRouterValue["rememberNavViewport"]>(
    (v) => writeTop({ navCamera: v }), [writeTop],
  );
  const rememberNavSelection = useCallback<ZoomRouterValue["rememberNavSelection"]>(
    (s) => writeTop({ navSelection: s }), [writeTop],
  );
  const rememberBoardCamera = useCallback<ZoomRouterValue["rememberBoardCamera"]>(
    (c) => writeTop({ boardCamera: c }), [writeTop],
  );

  const value = useMemo<ZoomRouterValue>(() => ({
    current,
    canGoBack: stack.length > 0,
    stackDepth: stack.length,
    zoomInto,
    zoomOut,
    goToMap,
    replaceVariant,
    rememberNavViewport,
    rememberNavSelection,
    rememberBoardCamera,
  }), [current, stack.length, zoomInto, zoomOut, goToMap, replaceVariant, rememberNavViewport, rememberNavSelection, rememberBoardCamera]);

  return createElement(ZoomRouterContext.Provider, { value }, children);
}

/**
 * Hook returning the current Zoom Navigator state + actions. Must be called
 * inside a `<ZoomRouterProvider>` subtree.
 */
export function useZoomRouter(): ZoomRouterValue {
  const ctx = useContext(ZoomRouterContext);
  if (!ctx) {
    throw new Error("useZoomRouter must be used inside <ZoomRouterProvider>");
  }
  return ctx;
}
