# Repository Guidelines

## Project Structure & Module Organization

`20261004-1154-IDFvHamas-prompt.md` is the original game specification; read it before implementing changes. The game, tests and asset pipeline are described in `README.md`.

Use the specified TypeScript, Vite, npm, and Babylon.js 9.x stack. Recommended layout: `src/` for bootstrap and gameplay modules, `src/config/` for tuning values, `tests/` for logic and browser tests, and `public/assets/` for local models, textures, and audio. Separate player, weapons, enemies, maps, waves, audio, and UI responsibilities. Generate the static deployment in `dist/`.

## Build, Test, and Development Commands

No commands are configured yet. When scaffolding, define and document these package scripts:

- `npm install`: install project dependencies.
- `npm run dev`: start the Vite development server.
- `npm run typecheck`: run TypeScript checking without emitting files.
- `npm test`: run automated game-logic tests.
- `npm run build`: check types and produce `dist/`.
- `npm run preview`: serve the production build for smoke testing.

## Coding Style & Naming Conventions

Enable strict TypeScript and use ES modules. Adopt two-space indentation, `camelCase` for functions and variables, and `PascalCase` for classes and types. Use descriptive module names such as `wave-manager.ts`. Centralize gameplay constants in configuration modules. No formatter or linter is currently configured; document any tooling introduced.

## Testing Guidelines

No test framework or coverage threshold exists yet. Choose a TypeScript-compatible runner and name logic tests `*.test.ts`. Cover scoring, ammunition, damage, wave timing, respawns, supply limits, and state transitions. Verify that death preserves the wave timer and pause stops it. Use browser automation where practical to check menus, input, navigation, all three waves, and production startup. Check console errors and offline asset loading.

## Commit & Pull Request Guidelines

The project is versioned at https://github.com/rrcatto/IDFvHamas. `main` holds releases, each tagged `vX.YY`; record user-facing changes for each release in `CHANGELOG.md`. (The original specification predates this and says not to use Git; the owner has since chosen to publish the project.) Provide review handoffs describing changes, validation results, and remaining limitations; include screenshots for visual changes.

## Assets & Deployment Constraints

Bundle runtime resources locally; use relative asset paths. Do not add a backend, database, or persistent browser storage. Record external asset sources, creators, licences, and usage in `ASSET-CREDITS.md`; include required attribution in game credits. Disable development controls in production.
