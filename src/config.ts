import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  awtrixHost?: string;
  ignoreApps?: string[];
  logIgnoredApps?: boolean;
}

const CONFIG_DIR = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
const CONFIG_PATH = join(CONFIG_DIR, "awtrix-pipewire-on-air", "config.toml");

const DEFAULT_CONFIG: Config = {
  ignoreApps: ["cava", "pavucontrol"],
  logIgnoredApps: false,
};

export async function loadConfig(): Promise<Config> {
  try {
    const file = Bun.file(CONFIG_PATH);
    if (await file.exists()) {
      const configModule = await import(CONFIG_PATH);
      return { ...DEFAULT_CONFIG, ...configModule.default };
    }
  } catch (error) {
    console.error("Error loading config:", error);
  }
  return { ...DEFAULT_CONFIG };
}
