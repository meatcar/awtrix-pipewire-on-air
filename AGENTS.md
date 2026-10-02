# Agent guidelines for awtrix-pipewire-on-air

## Environment and checks

- Run development commands inside `nix develop` or through `direnv exec .`.
- Nix shell and formatter configuration live in `nix/flake-modules/`.
- Use the scripts in `package.json`; `bun run check` and `bun run test` are the hardware-free development checks. `nix flake check` also verifies the Nix package and devshell.
- Use `bun run fmt` for formatting. Oxfmt formats TypeScript, JSON, Markdown, and YAML; treefmt also runs the Nix formatters. Oxlint owns linting and `tsc` owns type checking.
- Keep required tests hardware-free. Fixture capture needs live audio hardware and is an explicit maintenance command, not a test.
- Nix generates dependency data from `bun.lock` in the store. Keep import-from-derivation enabled; there is no committed `bun.nix` to refresh.
- Before changing setup/resume, read `.agents/README.md`. Project tasks belong in `.agents/Taskfile.yml`; keep shared bootstrap scripts synchronized with `nix-templates`.

## Architecture

- **Runtime**: Bun with TypeScript
- **Entry point**: `index.ts` - CLI that monitors microphone and controls Awtrix display
- **Core modules**:
  - `src/pipewire-monitor.ts` - Real-time PipeWire monitoring via `pw-dump --monitor | jq`
  - `src/awtrix-client.ts` - HTTP client for Awtrix display API
  - `src/types.ts` - Shared TypeScript interfaces

## Code style

- **TypeScript**: Strict mode enabled, use explicit types for interfaces
- **Imports**: Use `.ts` extensions
- **Naming**: camelCase for variables/methods, PascalCase for classes/interfaces
- **Process spawning**: Use `Bun.spawn()` for long-running streaming commands (not `$` helper)
- **Error handling**: Try/catch with console.error for parsing errors, throw for critical failures
