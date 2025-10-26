# awtrix-on-air

Monitor your microphone usage and display an "ON AIR" indicator on your Ulanzi TC001.

This tool watches PipeWire for active microphone streams and automatically shows/hides an "ON AIR" message on your [Ulanzi TC001](https://www.ulanzi.com/products/ulanzi-pixel-smart-clock-2882) running [Awtrix](https://awtrix.blueforcer.de/) firmware - perfect for letting others know when you're in a call or recording.

## Features

- **Real-time monitoring** - Uses `pw-dump --monitor` for instant microphone detection
- **Debounced updates** - Prevents flickering from transient audio streams
- **Multiple app support** - Detects microphone usage from any application
- **Clean state management** - Automatically clears the display on startup and shutdown

## Requirements

- [Bun](https://bun.sh) runtime
- PipeWire audio system
- [Ulanzi TC001](https://www.ulanzi.com/products/ulanzi-pixel-smart-clock-2882) running [Awtrix firmware](https://awtrix.blueforcer.de/) on your local network
- `jq` for JSON processing

## Installation

```bash
bun install
```

## Usage

Set your Ulanzi TC001 host (running Awtrix firmware):

```bash
export AWTRIX_HOST="192.168.1.100"
bunx awtrix-on-air
```

Or pass it as an argument:

```bash
bunx awtrix-on-air --awtrix-host 192.168.1.100
```

If running from source:

```bash
bun run index.ts --awtrix-host 192.168.1.100
```

The monitor will run until you press Ctrl+C.

## Development

This project uses [Nix](https://nixos.org/) for development dependencies. Enter the development shell with:

```bash
nix develop
```

**Format code:**
```bash
bun run fmt
```

**Run tests:**
```bash
bun test
```

**Type check:**
```bash
bunx tsc --noEmit
```

## Testing

Tests use real PipeWire output fixtures captured from different microphone usage scenarios. To recapture test fixtures (requires `arecord` from `alsa-utils`, available in the Nix dev shell):

```bash
bun test/fixtures/capture-fixtures.ts
```

See [test/fixtures/README.md](test/fixtures/README.md) for more details.

## How It Works

1. Spawns `pw-dump --monitor | jq` to stream PipeWire state changes
2. Parses JSON events looking for `Stream/Input/Audio` objects (microphone streams)
3. Debounces state changes to prevent rapid flickering
4. Sends HTTP requests to the Ulanzi TC001 (via Awtrix API) to show/hide "ON AIR" indicator

## License

MIT
