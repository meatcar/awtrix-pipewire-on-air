import { spawn } from "bun";

interface PipeWireObject {
  id: number;
  type: string;
  info?: {
    props?: {
      "media.class"?: string;
      "application.name"?: string;
      "node.name"?: string;
    };
  };
}

export class PipeWireWatcher {
  private interval: Timer | null = null;
  private onMicChanged: (isActive: boolean, appName?: string) => void;
  private currentlyActive = false;
  private pollIntervalMs: number;

  constructor(
    onMicChanged: (isActive: boolean, appName?: string) => void,
    pollIntervalMs = 1000
  ) {
    this.onMicChanged = onMicChanged;
    this.pollIntervalMs = pollIntervalMs;
  }

  async start(): Promise<void> {
    await this.checkMicStatus();
    
    this.interval = setInterval(async () => {
      await this.checkMicStatus();
    }, this.pollIntervalMs);
  }

  private async checkMicStatus(): Promise<void> {
    try {
      const proc = spawn(["pw-dump"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const output = await new Response(proc.stdout).text();
      const data: PipeWireObject[] = JSON.parse(output);

      const micStreams = data.filter(
        (obj) => obj.info?.props?.["media.class"] === "Stream/Input/Audio"
      );

      const isActive = micStreams.length > 0;
      const appName = micStreams[0]?.info?.props?.["application.name"];

      if (isActive !== this.currentlyActive) {
        this.currentlyActive = isActive;
        this.onMicChanged(isActive, appName);
      }
    } catch (error) {
      console.error("Failed to check PipeWire status:", error);
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
