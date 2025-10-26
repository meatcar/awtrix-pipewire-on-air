import { spawn } from "bun";
import type { NiriEvent, WindowOpenedOrChanged } from "./types";

export class NiriWatcher {
  private process: ReturnType<typeof spawn> | null = null;
  private onWindowChanged: (title: string, isOpen: boolean) => void;
  private currentlyMatching = false;

  constructor(
    onWindowChanged: (title: string, isOpen: boolean) => void
  ) {
    this.onWindowChanged = onWindowChanged;
  }

  async start(): Promise<void> {
    this.process = spawn(["niri", "msg", "--json", "event-stream"], {
      stdout: "pipe",
      stderr: "inherit",
    });

    if (!this.process.stdout) {
      throw new Error("Failed to get stdout from niri process");
    }

    const decoder = new TextDecoder();
    const stdout = this.process.stdout as ReadableStream<Uint8Array>;
    
    for await (const chunk of stdout) {
      const lines = decoder.decode(chunk).split("\n");
      
      for (const line of lines) {
        if (line.trim() === "") continue;
        
        try {
          const event: NiriEvent = JSON.parse(line);
          this.handleEvent(event);
        } catch (error) {
          console.error("Failed to parse event:", error);
        }
      }
    }
  }

  private handleEvent(event: NiriEvent): void {
    if ("WindowOpenedOrChanged" in event) {
      const windowEvent = event as WindowOpenedOrChanged;
      const { title } = windowEvent.WindowOpenedOrChanged.window;
      
      const matches = title.startsWith("Meet - ");
      
      if (matches && !this.currentlyMatching) {
        this.currentlyMatching = true;
        this.onWindowChanged(title, true);
      } else if (!matches && this.currentlyMatching) {
        this.currentlyMatching = false;
        this.onWindowChanged(title, false);
      }
    }
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
