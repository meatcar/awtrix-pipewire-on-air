#!/usr/bin/env bun
import { parseArgs } from "util";
import { AwtrixClient } from "./src/awtrix-client";
import { PipeWireMonitor } from "./src/pipewire-monitor";
import { loadConfig } from "./src/config";

const usage = `Usage: bun index.ts [options]

Watches for microphone usage and controls an Awtrix display.

Options:
    -h, --help               Show this help message
    --awtrix-host <host>     Awtrix display host (IP:port)
    -i, --ignore-apps <apps> Comma-delimited list of application names (exact or partial matches) to ignore, overriding env var, config file, and defaults
    --log-ignored            Log when applications are ignored due to being in the ignore list

Environment Variables:
    AWTRIX_HOST              Awtrix display host (required)
    AWTRIX_IGNORE_APPS       Comma-delimited list of application names to ignore
    AWTRIX_LOG_IGNORED       Log ignored applications (true/false)

Configuration:
  Config file: ~/.config/awtrix-pipewire-on-air/config.toml (or $XDG_CONFIG_HOME)
    See config.example.toml for available settings
  `;

(async () => {
  const config = await loadConfig();

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
      "log-ignored": {
        type: "boolean",
      },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    console.log(usage);
    process.exit(0);
  }

  const awtrixHost =
    values["awtrix-host"] ?? process.env.AWTRIX_HOST ?? config.awtrixHost;
  const ignoreApps = values["ignore-apps"]
    ? values["ignore-apps"].split(",").map((s) => s.trim())
    : process.env.AWTRIX_IGNORE_APPS
      ? process.env.AWTRIX_IGNORE_APPS.split(",").map((s) => s.trim())
      : config.ignoreApps || ["cava", "pavucontrol"];
  const logIgnoredApps =
    values["log-ignored"] ??
    (process.env.AWTRIX_LOG_IGNORED
      ? process.env.AWTRIX_LOG_IGNORED === "true"
      : config.logIgnoredApps) ??
    false;

  if (!awtrixHost) {
    console.error(
      "Error: AWTRIX_HOST environment variable or --awtrix-host argument is required",
    );
    process.exit(1);
  }

  const awtrixClient = new AwtrixClient(awtrixHost);
  const pipeWireMonitor = new PipeWireMonitor(
    async (isActive, appName) => {
      const status = isActive ? "activated" : "deactivated";
      const app = appName ? ` (${appName})` : "";
      console.log(`\x1b[36mMicrophone ${status}${app}\x1b[0m`);

      try {
        if (isActive) {
          await awtrixClient.showOnAir();
          console.log("\x1b[32m✓ ON AIR indicator activated\x1b[0m");
        } else {
          await awtrixClient.hideOnAir();
          console.log("\x1b[31m✓ ON AIR indicator deactivated\x1b[0m");
        }
      } catch (error) {
        console.error("\x1b[31mFailed to update Awtrix display:\x1b[0m", error);
      }
    },
    ignoreApps,
    logIgnoredApps,
  );

  console.log("\x1b[35mConfiguration:\x1b[0m");
  console.log(`  Awtrix host: ${awtrixHost}`);
  console.log(`  Ignored apps: ${ignoreApps.join(", ") || "none"}`);
  console.log(`  Log ignored apps: ${logIgnoredApps ? "yes" : "no"}`);
  console.log("");

  console.log(
    "Watching for microphone usage via PipeWire (real-time monitoring)",
  );
  console.log(`Awtrix display: ${awtrixHost}`);
  console.log("Starting monitor...");

  process.on("SIGINT", () => {
    console.log("\[33m\nStopping monitor[0m...");
    pipeWireMonitor.stop();
    process.exit(0);
  });

  await awtrixClient.ensureCleanState();
  await pipeWireMonitor.start();
})().catch((error) => {
  console.error("\x1b[31mFatal error:\x1b[0m", error);
  process.exit(1);
});
