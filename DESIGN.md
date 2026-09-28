# Enclosure Pro: Design Overview

## Purpose

Enclosure Pro lays out drill holes for guitar effects pedal enclosures. The user picks an enclosure, places components (potentiometers, switches, jacks, LEDs and footprint guides) on an unfolded view of its sides, and exports a true-to-scale PDF template. The printed template is cut out, wrapped around the physical enclosure and used as a center-punch guide.

The central requirement is dimensional accuracy. A component placed on screen must print at the exact physical position and size.

## System overview

The repository contains two independent parts:

| Part | Location | Role |
|---|---|---|
| Desktop app | `electron/`, `client/` | The design tool. Electron shell with a React renderer. |
| Website | `*.html` at the repo root, `styles.css`, `stats.js` | Public landing page, documentation, release notes and feedback form. |

The two share no code. The website reads GitHub Releases at runtime (`stats.js`) to show the download count and link to the latest installers. The app's auto-updater reads the same releases.

## Desktop app architecture

### Process model

- **Main process** (`electron/main.js`):
  - creates a single window and builds the native application menu
  - owns every file-system and dialog operation, and runs the auto-updater (`electron-updater`, GitHub provider)
  - enforces a single instance
  - routes `.enc` files opened from the OS (command-line arguments on Windows and Linux, the `open-file` event on macOS) to the renderer
- **Preload** (`electron/preload.js`):
  - exposes `window.electronAPI` through `contextBridge`
  - the renderer runs with `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false`, so every privileged operation goes through this bridge
- **Renderer** (`client/src/`):
  - a React 18 app built by Vite into `dist/public/`, which the main process loads with `loadFile`

### Communication

- **Renderer to main:** request/response calls through `ipcRenderer.invoke`, for file dialogs, reads and writes, window close, app version and update checks.
- **Main to renderer:** events. `menu-action` carries a string action (`new`, `open`, `save`, `save-as`, `export-pdf`, `quit`) when a native menu item fires. Other events cover update progress, close requests and OS file-open requests.
- **Closing the window:** the main process intercepts `close` and asks the renderer, which shows a save/discard dialog if there are unsaved changes before calling `window:close`.

### Renderer structure

`pages/Designer.tsx` holds the top-level state and composes feature hooks:

| Hook | Responsibility |
|---|---|
| `useFileOperations` | New, open, save and save-as, dirty tracking, legacy-file handling |
| `useComponentManagement` | Adding, moving and deleting placed components |
| `useContextMenu` | Right-click actions: duplicate, rotate 90°, include in or exclude from export |
| `useKeyboardShortcuts` | In-page keyboard shortcuts |
| `usePDFExport` + `useBaseExport` | PDF generation |
| `useConfirmDialogs` | Save/discard prompts for new, open and quit |

Menu handlers are stable functions that read the latest hook state through refs. This lets the IPC listeners register once without going stale.

The main visual components are:
- `UnwrappedCanvas`: the interactive canvas.
- `TopControls`: app menu, zoom, rotate and project menu.
- `BottomInfo`: enclosure, units, grid and components.
- `EnclosureSelector`, `ComponentPalette`, `GridSelector`: the pickers.
- `BlankCanvas`: the start screen shown before an enclosure is chosen.

### Data model

All domain data is static and lives in `client/src/types/schema.ts`:

- **`MANUFACTURERS`:** enclosure makers, with display color and badge.
- **`ENCLOSURE_TYPES`:** each enclosure's outer width, height and depth in millimeters, corner style, manufacturer and display name. Keys carry a manufacturer prefix (such as `AMP-1590B` or `TAY-125B`). Unprefixed keys (`1590B`, `125B`, …) remain for projects saved before v1.1.0. `normalizeEnclosureType` and `convertLegacyProjectState` map them forward.
- **`COMPONENT_TYPES`:** each component's drill diameter (or rectangle size), imperial label, category and shape. The "Footprint Guides" category is drawn dashed, sits behind regular components, and is excluded from export by default.

A project is a `ProjectState`: the enclosure type, a list of `PlacedComponent` records (id, type, side, x/y offset from the side's center, rotation, and an optional `excludeFromPrint`), grid settings, zoom, canvas rotation and the measurement unit.

### Coordinate system

An enclosure is drawn as an unfolded cross. The front face is in the center, with top, bottom, left and right attached along its edges (`getUnwrappedDimensions`). The side dimensions come from the enclosure's width, height and depth.

Component positions are stored relative to the center of their side, in canvas pixels at 96 DPI (`mmToPixels = 3.7795…`). The canvas can be rotated 90° as a whole. Side labels and drag directions are remapped for enclosures whose labels rotate with the canvas (`rotatesLabels`).

### Project files

Projects save as JSON with the `.enc` extension, and the installers register this extension with the OS. On load, the file is checked against a permissive `zod` schema that accepts older field shapes, then passed through the legacy conversion.

### PDF export

Export draws the layout onto an off-screen, high-DPI canvas (`useBaseExport.renderCanvas`) and places that image in a `jsPDF` document sized in millimeters.
- **Page size:** chosen automatically from the enclosure size. Large enclosures get a custom page size with margins for the header and footer.
- **Page contents:**
  - a header and footer with the enclosure and project details
  - a calibration mark, so the user can confirm the printout is at 100% scale
- **Excluded components:** those marked `excludeFromPrint`, and footprint guides by default, are left out.
- After saving, the app shows print instructions telling the user to print from a dedicated PDF reader at actual size.

The on-screen canvas and the export renderer are separate implementations that share `schema.ts` but not their drawing geometry.

Direct printing was removed in v1.1.0 in favor of PDF export, which prints at a more reliable scale. "Print" in the UI now means Print/Export to PDF (Ctrl/Cmd+P). Ctrl/Cmd+E remains a legacy alias.

### Menus and shortcuts

The same commands can be reached three ways:
- **Native application menu** (`main.js`): visible on macOS. On Windows and Linux the menu bar is hidden, but its accelerators stay registered.
- **In-app project menu** (`FileDropdownMenu`).
- **In-page keyboard handler** (`useKeyboardShortcuts`).

Commands that need an open enclosure (save, save-as, export and zoom) are gated in the in-app menu and the keyboard handler by whether an enclosure is selected. The native menu is meant to follow the same state through the `app:update-menu-state` IPC call.

### Updates

The app checks GitHub Releases five seconds after launch, and again whenever the user asks from the App Menu. When an update is available the user confirms the download. When it finishes the app offers to restart, and it installs on quit if the restart is postponed. Pre-releases are ignored.

### Development mode

`dev.config.js` (gitignored) enables DevTools, reload shortcuts and the in-app test tools (a printer scale test and a simulated update). Without it, the app runs in production mode.

## Build and release

- `npm run electron:dev` runs Vite and Electron together for development.
- `npm run electron:build` builds the renderer, copies the icons into `build/` and packages the app with electron-builder:
  - NSIS installer on Windows, with custom scripts in `scripts/`
  - universal DMG and ZIP on macOS
  - AppImage on Linux
- Pushing a `v*` tag triggers `.github/workflows/build.yml`, which builds on all three platforms and publishes the installers to GitHub Releases. The website and the auto-updater both pick those releases up.

## Website

The website is hand-written static HTML with a single stylesheet, a tan, orange and near-black palette defined in `styles.css`, and Font Awesome icons. It's served as `samoff.com/enclosure-pro`. `stats.js` fetches `api.github.com/repos/timsamoff/enclosure-pro/releases` on load, adds the total download count, and replaces the three installer links with the latest release's assets. The links hardcoded in the HTML are only a fallback if that request fails. The feedback page embeds a Google Form.
