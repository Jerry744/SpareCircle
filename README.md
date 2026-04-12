
  # SpareCircle

  SpareCircle is an open source visual workflow and translation toolchain for LVGL-based UI projects.

  The project focuses on practical editor workflows: widget composition, hierarchy management, inspector-driven editing, and data export paths that map cleanly to LVGL development.

  ## Project Status

  SpareCircle is currently in active development.

  - Core visual editor interactions are available (canvas, selection, move, resize).
  - Widget insert and hierarchy sync are implemented.
  - Inspector/property roundtrip and project serialization are in progress.
  - Export pipeline and multi-screen workflow are under iterative development.

  Planned milestones are tracked in [TODO.md](TODO.md).

  ## Current Capabilities

  - Visual canvas editor with drag/select/move/resize interactions
  - Widget palette with insert flow into valid container nodes
  - Hierarchy tree synchronization and drag reorder behavior
  - Inspector-based property editing with validation hooks
  - Project JSON save/load wiring
  - Keyboard and pointer interaction support tuned for desktop workflows

  ## Tech Stack

  - React + TypeScript
  - Vite
  - Tailwind CSS
  - Modular editor backend state architecture

  ## Getting Started

  ### Requirements

  - Node.js 18+
  - npm 9+

  ### Install

  ```bash
  npm install
  ```

  ### Run Development Server

  ```bash
  npm run dev
  ```

  ### Build

  ```bash
  npm run build
  ```

  ## Project Structure

  ```text
  src/
    app/
      backend/       # editor state, reducer, tree ops, validation, interaction
      components/    # IDE panels and canvas UI
      routes.tsx     # app routes
    styles/          # global and theme styles
  ```

  ## Roadmap

  See [TODO.md](TODO.md) for phased milestone planning, including:

  - Inspector two-way binding completion
  - Multi-screen editing lifecycle
  - Minimal LVGL C export
  - Style token system and event mapping

  ## License

  This project is licensed under the MIT License. See [LICENSE](LICENSE) for full text.

  SpareCircle adopts the same license model used by LVGL (MIT), which keeps integration and commercial usage straightforward.

  ## Attribution

  This repository includes third-party components and assets.

  - Attribution details: [ATTRIBUTIONS.md](ATTRIBUTIONS.md)

  ## Notes

  SpareCircle is an independent open source project and is not affiliated with LVGL LLC.
  