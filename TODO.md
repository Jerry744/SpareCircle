# SpareCircle Demo TODO

This checklist focuses on the most important demos needed to move from a frontend-only prototype to a usable LVGL tool.

## P0 - Must Have (Core Value)

- [x] Demo 1: Visual Editor Core (Canvas + Select + Move + Resize)
  - Goal: Build a stable base interaction loop like an actual UI editor.
  - Done when:
    - Single and multi-select both work.
    - Dragging and resizing update widget model data in real time.
    - Undo/redo works for move and resize actions.

- [x] Demo 2: Widget Insert + Hierarchy Sync
  - Goal: Make "add widget" useful, not only visual.
  - Done when:
    - Drag/drop from widget panel creates nodes in tree.
    - Tree order and canvas order stay consistent.
    - Parent-child nesting (container -> child widget) works.

- [ ] Demo 3: Inspector Two-Way Binding
  - Goal: Confirm property editing can drive real output.
  - Done when:
    - Width/height/position/text/color updates are reflected instantly.
    - Invalid input is validated with clear UI feedback.
    - Changes are serialized into a project JSON model.

- [ ] Demo 4: Multi-Screen Navigation Flow
  - Goal: Match basic screen workflow used by LVGL projects.
  - Done when:
    - Can create, rename, duplicate, delete screens.
    - Active screen switch updates hierarchy and inspector correctly.
    - Per-screen root settings are editable.

- [ ] Demo 5: LVGL C Code Export (Minimal)
  - Goal: Prove SpareCircle is more than a drawing tool.
  - Done when:
    - Export generates compilable C for common widgets (label/button/container/image).
    - Generated code includes screen init entry functions.
    - Export result passes a smoke compile test in a sample LVGL project.

## Detailed Plans (Demo 2-5)

### Demo 2 Plan: Widget Insert + Hierarchy Sync

- Scope:
  - Support insert flow for container, label, button, image.
  - Keep canvas node tree and hierarchy panel tree strictly consistent.
- Work breakdown:
  - Define canonical node model fields: `id`, `type`, `parentId`, `children`, `props`, `style`.
  - Implement `addWidget(parentId, type)` command as the only write entry.
  - Implement drag/drop handlers from widget panel to canvas and hierarchy panel.
  - Add tree reorder command (`moveNode`) and parent change command (`reparentNode`).
  - Add guard rules: no cycle, no invalid parent type, root-level constraints.
  - Add snapshot tests for tree transforms and UI sync tests for canvas/hierarchy.
- Deliverables:
  - Stable insert/reorder/reparent interactions.
  - Deterministic node order in both views.
- Exit criteria:
  - 20+ manual DnD operations without desync.
  - Reloading state preserves exact hierarchy order.

### Demo 3 Plan: Inspector Two-Way Binding

- Scope:
  - Cover core properties first: position, size, text, color, visibility.
  - Ensure all edits update model and canvas in one state transaction.
- Work breakdown:
  - Build property schema map per widget type (editable fields and validation rules).
  - Add form controller for inspector with staged input + commit behavior.
  - Implement validation layer (range, type, required) with field-level messages.
  - Connect property updates to command stack for undo/redo compatibility.
  - Add JSON serializer/deserializer for project state integrity.
  - Add tests: valid update, invalid input rejection, undo/redo roundtrip.
- Deliverables:
  - Inspector edits instantly reflected on canvas.
  - Clean and stable project JSON output.
- Exit criteria:
  - Core fields pass validation matrix.
  - JSON save/load retains edited properties losslessly.

### Demo 4 Plan: Multi-Screen Navigation Flow

- Scope:
  - Implement complete screen lifecycle and active-screen context switching.
  - Keep inspector and hierarchy scoped to current active screen.
- Work breakdown:
  - Introduce `screens` model: `screenId`, `name`, `rootNodeId`, `meta`.
  - Add CRUD actions: create, rename, duplicate, delete with conflict handling.
  - Add active screen state and context-based selectors for right panel data.
  - Implement safe delete fallback (auto-select next available screen).
  - Add duplicate behavior rules: deep copy with regenerated node IDs.
  - Add tests for screen lifecycle and context isolation.
- Deliverables:
  - Screens panel drives all workspace context correctly.
  - No cross-screen property contamination.
- Exit criteria:
  - Repeated switch/edit/switch workflows remain consistent.
  - Duplicate and delete operations are deterministic.

### Demo 5 Plan: LVGL C Code Export (Minimal)

- Scope:
  - Export minimal but compilable LVGL C for label/button/container/image.
  - Include one entry API to initialize all screens.
- Work breakdown:
  - Define intermediate representation (IR) from project model for codegen.
  - Build widget emitters (`emitLabel`, `emitButton`, `emitContainer`, `emitImage`).
  - Build style/property mapper (position, size, text, color, src).
  - Generate output file layout:
    - `ui.h` declarations
    - `ui.c` screen/object creation and setup
    - optional `ui_events.c` callback stubs
  - Add deterministic naming strategy (`ui_<screen>_<widget>`).
  - Add export smoke test: run generated code in a minimal LVGL sample project.
- Deliverables:
  - Downloadable/exportable C source package.
  - Reproducible output for the same input model.
- Exit criteria:
  - Generated project compiles without manual edits.
  - Basic widgets appear and render correctly at runtime.

## Suggested Timeline (2-5)

1. Week 1: Demo 2 interaction and data model stabilization.
2. Week 2: Demo 3 inspector schema, validation, and serialization.
3. Week 3: Demo 4 multi-screen lifecycle and context isolation.
4. Week 4: Demo 5 IR + codegen + smoke compile pipeline.

## P1 - Should Have (Practicality)

- [ ] Demo 6: Style Tokens + Reusable Styles
  - Goal: Avoid repeated manual style edits.
  - Done when:
    - Can define named style tokens (color/spacing/radius/font).
    - Multiple widgets can reference the same style.
    - Changing token value updates all referencing widgets.

- [ ] Demo 7: Event and Action Mapping
  - Goal: Cover interactive behavior needed for real demos.
  - Done when:
    - Basic events (clicked, pressed, value_changed) can be bound.
    - Actions support at least screen switch and visibility toggle.
    - Export includes event callback stubs.

- [ ] Demo 8: Asset Pipeline (Image/Font)
  - Goal: Close the gap between UI prototype and firmware integration.
  - Done when:
    - Import image/font assets from UI.
    - Keep stable asset IDs/paths in project model.
    - Export references assets in predictable code structure.

## P2 - Nice to Have (Polish)

- [ ] Demo 9: Project Save/Load + Versioning
  - Goal: Allow iteration and collaboration.
  - Done when:
    - Save and reload full project state from JSON.
    - Detect version mismatch and provide migration warning.

- [ ] Demo 10: End-to-End Showcase Project
  - Goal: One complete public demo for users and contributors.
  - Done when:
    - Build a small smart-home UI (3-5 screens).
    - Export and run on an LVGL sample board/simulator.
    - Publish screenshots, generated code sample, and walkthrough.

## Suggested Execution Order

1. Demo 1 -> Demo 2 -> Demo 3
2. Demo 4 -> Demo 5
3. Demo 6 -> Demo 7 -> Demo 8
4. Demo 9 -> Demo 10
