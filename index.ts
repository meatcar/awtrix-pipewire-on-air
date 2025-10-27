#!/usr/bin/env bun
import { parseArgs } from "util";
import { AwtrixClient } from "./src/awtrix-client";
import { PipeWireMonitor } from "./src/pipewire-monitor";

const usage = `Usage: bun index.ts [options]

Watches for microphone usage and controls an Awtrix display.

Options:
  -h, --help              Show this help message
  --awtrix-host <host>    Awtrix display host (IP:port)
  -i, --ignore-apps <apps> Comma-delimited list of application names (exact or partial matches) to ignore, overriding built-in exclusions

Environment Variables:
  AWTRIX_HOST             Awtrix display host (required)
`;

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		help: {
			type: "boolean",
			short: "h",
		},
		"awtrix-host": {
			type: "string",
		},
		"ignore-apps": {
			type: "string",
			short: "i",
		},
	},
	strict: true,
	allowPositionals: false,
});

if (values.help) {
	console.log(usage);
	process.exit(0);
}

const awtrixHost = values["awtrix-host"] ?? process.env.AWTRIX_HOST;
const ignoreApps = values["ignore-apps"] ? values["ignore-apps"].split(",").map(s => s.trim()) : undefined;

if (!awtrixHost) {
	console.error(
		"Error: AWTRIX_HOST environment variable or --awtrix-host argument is required",
	);
	process.exit(1);
}

const awtrixClient = new AwtrixClient(awtrixHost);
const pipeWireMonitor = new PipeWireMonitor(async (isActive, appName) => {
	const status = isActive ? "activated" : "deactivated";
	const app = appName ? ` (${appName})` : "";
	console.log(`Microphone ${status}${app}`);

	try {
		if (isActive) {
			await awtrixClient.showOnAir();
			console.log("✓ ON AIR indicator activated");
		} else {
			await awtrixClient.hideOnAir();
			console.log("✓ ON AIR indicator deactivated");
		}
	} catch (error) {
		console.error("Failed to update Awtrix display:", error);
	}
}, ignoreApps);

console.log(
	"Watching for microphone usage via PipeWire (real-time monitoring)",
);
console.log(`Awtrix display: ${awtrixHost}`);
console.log("Starting monitor...\n");

process.on("SIGINT", () => {
	console.log("\nStopping monitor...");
	pipeWireMonitor.stop();
	process.exit(0);
});

(async () => {
	await awtrixClient.ensureCleanState();
	await pipeWireMonitor.start();
})().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
