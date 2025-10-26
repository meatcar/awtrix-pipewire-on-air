import { parseArgs } from 'util';
import { AwtrixClient } from './src/awtrix-client';
import { NiriWatcher } from './src/niri-watcher';

const usage = `Usage: bun index.ts [options]

Watches for Google Meet windows and controls an Awtrix display.

Options:
  -h, --help              Show this help message
  --awtrix-host <host>    Awtrix display host (IP:port)

Environment Variables:
  AWTRIX_HOST             Awtrix display host (required)
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
  },
  strict: true,
  allowPositionals: false,
});

if (values.help) {
  console.log(usage);
  process.exit(0);
}

const awtrixHost = values['awtrix-host'] ?? process.env.AWTRIX_HOST;

if (!awtrixHost) {
  console.error('Error: AWTRIX_HOST environment variable or --awtrix-host argument is required');
  process.exit(1);
}

const awtrixClient = new AwtrixClient(awtrixHost);
const niriWatcher = new NiriWatcher(async (title, isOpen) => {
  console.log(`Window ${isOpen ? 'opened' : 'closed'}: ${title}`);
  
  try {
    if (isOpen) {
      await awtrixClient.showOnAir();
      console.log('✓ ON AIR indicator activated');
    } else {
      await awtrixClient.hideOnAir();
      console.log('✓ ON AIR indicator deactivated');
    }
  } catch (error) {
    console.error('Failed to update Awtrix display:', error);
  }
});

console.log('Watching for Google Meet windows (title starts with "Meet - ")');
console.log(`Awtrix display: ${awtrixHost}`);
console.log('Starting watcher...\n');

process.on('SIGINT', () => {
  console.log('\nStopping watcher...');
  niriWatcher.stop();
  process.exit(0);
});

niriWatcher.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
