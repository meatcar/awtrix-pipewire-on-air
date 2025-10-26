# awtrix-on-air

Monitor your microphone usage and display an "ON AIR" indicator on your Awtrix display.

This tool watches PipeWire for active microphone streams and automatically shows/hides an "ON AIR" message on your [Awtrix](https://awtrix.blueforcer.de/) smart display - perfect for letting others know when you're in a call or recording.

## Features

- **Real-time monitoring** - Uses `pw-dump --monitor` for instant microphone detection
- **Debounced updates** - Prevents flickering from transient audio streams
- **Multiple app support** - Detects microphone usage from any application
- **Clean state management** - Automatically clears the display on startup and shutdown

## Requirements

- [Bun](https://bun.sh) runtime
- PipeWire audio system
- Awtrix display on your local network
- `jq` for JSON processing

## Installation

```bash
bun install
```

## Usage

Set your Awtrix display host:

```bash
export AWTRIX_HOST="192.168.1.100"
bun run index.ts
```

Or pass it as an argument:

```bash
bun run index.ts --awtrix-host 192.168.1.100
```

The monitor will run until you press Ctrl+C.

## Development

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

Tests use real PipeWire output fixtures captured from different microphone usage scenarios. To recapture test fixtures:

```bash
bun test/fixtures/capture-fixtures.ts
```

See [test/fixtures/README.md](test/fixtures/README.md) for more details.

## How It Works

1. Spawns `pw-dump --monitor | jq` to stream PipeWire state changes
2. Parses JSON events looking for `Stream/Input/Audio` objects (microphone streams)
3. Debounces state changes to prevent rapid flickering
4. Sends HTTP requests to Awtrix display to show/hide "ON AIR" indicator

## License

MIT
