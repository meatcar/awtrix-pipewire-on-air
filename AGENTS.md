# Agent Guidelines for awtrix-on-air

## Commands
- **Run**: `bun run index.ts` (requires `AWTRIX_HOST` env var or `--awtrix-host` flag)
- **Format**: `bun run fmt` (uses Biome)
- **Type check**: `bunx tsc --noEmit`

## Architecture
- **Runtime**: Bun with TypeScript
- **Entry point**: `index.ts` - CLI that monitors microphone and controls Awtrix display
- **Core modules**:
  - `src/pipewire-monitor.ts` - Real-time PipeWire monitoring via `pw-dump --monitor | jq`
  - `src/awtrix-client.ts` - HTTP client for Awtrix display API
  - `src/types.ts` - Shared TypeScript interfaces

## Code Style
- **Formatting**: Biome with tabs for indentation, double quotes
- **TypeScript**: Strict mode enabled, use explicit types for interfaces
- **Imports**: Use `.ts` extensions, organize imports (Biome handles this)
- **Naming**: camelCase for variables/methods, PascalCase for classes/interfaces
- **Process spawning**: Use `Bun.spawn()` for long-running streaming commands (not `$` helper)
- **Error handling**: Try/catch with console.error for parsing errors, throw for critical failures
