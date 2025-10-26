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

interface PipeWireEvent {
  type: "added" | "changed" | "removed";
  object?: PipeWireObject;
  id?: number;
}

export class PipeWireMonitor {
  private process: ReturnType<typeof spawn> | null = null;
  private onMicChanged: (isActive: boolean, appName?: string) => void;
  private activeMicStreams = new Map<number, string>();

  constructor(onMicChanged: (isActive: boolean, appName?: string) => void) {
    this.onMicChanged = onMicChanged;
  }

  async start(): Promise<void> {
    this.process = spawn(["sh", "-c", "pw-dump --monitor | stdbuf -oL jq -c '.'"], {
      stdout: "pipe",
      stderr: "inherit",
    });

    if (!this.process.stdout) {
      throw new Error("Failed to get stdout from pw-dump process");
    }

    const decoder = new TextDecoder();
    const stdout = this.process.stdout as ReadableStream<Uint8Array>;
    let buffer = "";

    for await (const chunk of stdout) {
      buffer += decoder.decode(chunk, { stream: true });
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        
        try {
          const data = JSON.parse(line);
          this.handleDump(data);
        } catch (error) {
          console.error("Failed to parse JSON line:", error);
        }
      }
    }
  }

  private handleDump(objects: PipeWireObject[]): void {
    const currentMicStreams = new Map<number, string>();
    
    for (const obj of objects) {
      const mediaClass = obj.info?.props?.["media.class"];
      const appName = obj.info?.props?.["application.name"] || obj.info?.props?.["node.name"];
      
      if (mediaClass === "Stream/Input/Audio") {
        currentMicStreams.set(obj.id, appName || "Unknown");
      }
    }
    
    const wasActive = this.activeMicStreams.size > 0;
    const isActive = currentMicStreams.size > 0;
    
    if (!wasActive && isActive) {
      const firstApp = currentMicStreams.values().next().value;
      this.onMicChanged(true, firstApp);
    } else if (wasActive && !isActive) {
      this.onMicChanged(false);
    }
    
    this.activeMicStreams = currentMicStreams;
  }



  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.activeMicStreams.clear();
  }
}
