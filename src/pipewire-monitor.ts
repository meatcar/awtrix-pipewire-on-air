import type { Subprocess } from "bun";

const DEBOUNCE_MS = 500;
const MEDIA_CLASS_MIC_INPUT = "Stream/Input/Audio";

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

/**
 * Monitors PipeWire for active microphone streams in real-time.
 *
 * Uses `pw-dump --monitor | jq` to stream PipeWire state changes and detects
 * when applications start or stop using the microphone (Stream/Input/Audio).
 * Includes debouncing to prevent rapid state changes from causing flicker.
 */
export class PipeWireMonitor {
	private process: Subprocess | null = null;
	private onMicChanged: (isActive: boolean, appName?: string) => void;
	private activeMicStreams = new Map<number, string>();
	private debounceTimer: Timer | null = null;
	private pendingState: { isActive: boolean; appName?: string } | null = null;
	private debounceMs = DEBOUNCE_MS;

	/**
	 * Creates a new PipeWire monitor.
	 *
	 * @param onMicChanged Callback invoked when microphone state changes.
	 *                     Called with (true, appName) when mic activates,
	 *                     (false) when mic deactivates.
	 */
	constructor(onMicChanged: (isActive: boolean, appName?: string) => void) {
		this.onMicChanged = onMicChanged;
	}

	/**
	 * Starts monitoring PipeWire for microphone activity.
	 *
	 * Spawns `pw-dump --monitor | jq` and processes the stream until stopped.
	 * This method runs until the process is killed via `stop()`.
	 */
	async start(): Promise<void> {
		const proc = Bun.spawn(
			["sh", "-c", "pw-dump --monitor | jq --unbuffered -c '.'"],
			{
				stdout: "pipe",
				stderr: "inherit",
			},
		);

		this.process = proc;

		const decoder = new TextDecoder();
		let buffer = "";

		for await (const chunk of proc.stdout) {
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
			const appName =
				obj.info?.props?.["application.name"] || obj.info?.props?.["node.name"];

			if (mediaClass === MEDIA_CLASS_MIC_INPUT) {
				currentMicStreams.set(obj.id, appName || "Unknown");
			}
		}

		const isActive = currentMicStreams.size > 0;
		const appName = currentMicStreams.values().next().value;

		this.pendingState = { isActive, appName };

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			this.flushPendingState();
		}, this.debounceMs);
	}

	private flushPendingState(): void {
		if (!this.pendingState) return;

		const wasActive = this.activeMicStreams.size > 0;
		const { isActive, appName } = this.pendingState;

		if (!wasActive && isActive) {
			this.onMicChanged(true, appName);
			this.activeMicStreams.set(1, appName || "Unknown");
		} else if (wasActive && !isActive) {
			this.onMicChanged(false);
			this.activeMicStreams.clear();
		}

		this.pendingState = null;
	}

	/**
	 * Stops the PipeWire monitor and cleans up resources.
	 *
	 * Kills the subprocess, clears timers, and resets internal state.
	 */
	stop(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		if (this.process) {
			this.process.kill();
			this.process = null;
		}
		this.activeMicStreams.clear();
	}
}
