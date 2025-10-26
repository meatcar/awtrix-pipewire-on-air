import { $ } from "bun";
import { parseArgs } from 'util';

const usage = `Usage: bun index.ts [options] <positional-args>

Options:
  -h, --help     Show this help message
`;

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    }
  },
  strict: true,
  allowPositionals: true
});

if (values.help) {
  console.log(usage);
  process.exit(0);
} else if (positionals.length === 2 && Object.keys(values).length === 0) {
  console.error("Error: Unexpected positional arguments without options.");
  console.error(usage);
  process.exit(1);
}

console.log("Parsed Values:", values);
console.log("Positional Arguments:", positionals);
