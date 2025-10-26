import { parseArgs } from 'util';
import { AwtrixClient } from './src/awtrix-client';
import { PipeWireWatcher } from './src/pipewire-watcher';
// import { NiriWatcher } from './src/niri-watcher';

const usage = `Usage: bun index.ts [options]

Watches for microphone usage and controls an Awtrix display.

Options:
  -h, --help              Show this help message
  --awtrix-host <host>    Awtrix display host (IP:port)
  --poll-interval <ms>    PipeWire polling interval in milliseconds (default: 1000)

Environment Variables:
  AWTRIX_HOST             Awtrix display host (required)
  POLL_INTERVAL           PipeWire polling interval in ms (default: 1000)
`;

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
    'awtrix-host': {
      type: 'string',
    },
    'poll-interval': {
      type: 'string',
    },
  },
  strict: true,
  allowPositionals: false,
});

if (values.help) {
  console.log(usage);
  process.exit(0);
}

const awtrixHost = values['awtrix-host'] ?? process.env.AWTRIX_HOST;
const pollInterval = parseInt(values['poll-interval'] ?? process.env.POLL_INTERVAL ?? '1000');

if (!awtrixHost) {
  console.error('Error: AWTRIX_HOST environment variable or --awtrix-host argument is required');
  process.exit(1);
}

const awtrixClient = new AwtrixClient(awtrixHost);
const pipeWireWatcher = new PipeWireWatcher(async (isActive, appName) => {
  const status = isActive ? 'activated' : 'deactivated';
  const app = appName ? ` (${appName})` : '';
  console.log(`Microphone ${status}${app}`);
  
  try {
    if (isActive) {
      await awtrixClient.showOnAir();
      console.log('✓ ON AIR indicator activated');
    } else {
      await awtrixClient.hideOnAir();
      console.log('✓ ON AIR indicator deactivated');
    }
  } catch (error) {
    console.error('Failed to update Awtrix display:', error);
  }
}, pollInterval);

console.log('Watching for microphone usage via PipeWire');
console.log(`Awtrix display: ${awtrixHost}`);
console.log(`Poll interval: ${pollInterval}ms`);
console.log('Starting watcher...\n');

process.on('SIGINT', () => {
  console.log('\nStopping watcher...');
  pipeWireWatcher.stop();
  process.exit(0);
});

pipeWireWatcher.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
