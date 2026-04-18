/*
 * BottomPanel entry:
 * - structural shell and tab routing live in `BottomPanel.container.tsx`
 * - tab metadata lives in `bottomPanel/config.tsx`
 * - each business area has its own file under `bottomPanel/`
 *
 * Future changes:
 * - add a new tab: update `bottomPanel/config.tsx` and `BottomPanelContent`
 * - expand one tab heavily: continue splitting inside that tab's own module
 */
export { BottomPanel } from "./BottomPanel.container";
