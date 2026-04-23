import { useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";
import type { ProjectSnapshot, EditorAction } from "../types";
import { deserializeProjectSnapshot, serializeProjectSnapshot } from "../validation";
import { loadActiveProjectFromIndexedDb, saveActiveProjectToIndexedDb } from "../persistence";

const SAVE_DEBOUNCE_MS = 500;

/**
 * Owns the IndexedDB lifecycle for the active project:
 * - hydrates state from persisted snapshot on mount (once)
 * - debounces snapshot writes on every project mutation
 *
 * Kept as a standalone hook so the EditorBackendProvider stays a wiring layer.
 */
export function useProjectAutoSave(
  project: ProjectSnapshot,
  dispatch: Dispatch<EditorAction>,
): { isPersistenceReady: boolean } {
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const saved = await loadActiveProjectFromIndexedDb();
        if (!saved || cancelled) {
          return;
        }

        const restored = deserializeProjectSnapshot(saved.serializedProject);
        if (restored.ok) {
          dispatch({ type: "hydrateProject", project: restored.project });
          if (restored.warning) {
            console.warn(restored.warning);
          }
        }
      } catch (error) {
        console.warn("Failed to restore project from IndexedDB", error);
      } finally {
        if (!cancelled) {
          setIsPersistenceReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isPersistenceReady) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = window.setTimeout(() => {
      const serialized = serializeProjectSnapshot(project);
      void saveActiveProjectToIndexedDb(serialized).catch((error) => {
        console.warn("Failed to persist project to IndexedDB", error);
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [project, isPersistenceReady]);

  return { isPersistenceReady };
}
