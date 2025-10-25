import { $ } from "bun";
import { parseArgs } from 'util';

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    help: {
      type: 'boolean',
      short: 'h',
      description: 'Display help information'
    }
  },
  strict: true,
  allowPositionals: true
});

console.log("Parsed Values:", values);
console.log("Positional Arguments:", positionals);
