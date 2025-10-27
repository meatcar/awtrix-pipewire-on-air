import type { Subprocess } from "bun";
import createDebug from "debug";

const debug = createDebug("awtrix:pipewire");
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
 * Properly handles PipeWire events (added/changed/removed) to track state changes.
 */
export class PipeWireMonitor {
	private process: Subprocess | null = null;
	private onMicChanged: (isActive: boolean, appName?: string) => void;
	private activeMicStreams = new Map<number, string>();
	private lastEmittedActive = false;

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
				const trimmed = line.trim();
				if (!trimmed) continue;

				try {
					const data = JSON.parse(trimmed);
					this.handleMessage(data);
				} catch (error) {
					console.error("Failed to parse JSON line:", error);
				}
			}
		}
	}

	private handleMessage(msg: unknown): void {
		try {
			// Handle array dumps (PARTIAL/DELTA batches, NOT full snapshots)
			// pw-dump --monitor sends partial batches that may only contain changed objects.
			// An active mic stream may be absent from a batch - absence does NOT mean removal.
			// We rely on maybeTrackObject(authoritative=true) to detect class changes.
			if (Array.isArray(msg)) {
				const snapshotSummary = msg
					.map((o) => `${o.id}:${o.info?.props?.["media.class"] || "?"}`)
					.join(",");
				debug("Batch: %d objects [%s]", msg.length, snapshotSummary);
				const beforeSize = this.activeMicStreams.size;
				for (const obj of msg) {
					this.maybeTrackObject(obj, true);
				}
				const afterSize = this.activeMicStreams.size;
				debug("After batch: %d active mics (was %d)", afterSize, beforeSize);
				if (beforeSize !== afterSize) {
					this.maybeEmitChange(`batch update: ${beforeSize}→${afterSize} mics`);
				}
				return;
			}

			// Handle explicit PipeWire events (added/changed/removed)
			// These are authoritative signals about state changes and should always be respected.
			if (msg && typeof msg === "object") {
				const ev = msg as PipeWireEvent;
				const id = ev.id ?? ev.object?.id;

				// Explicit removal event - always remove from tracking
				if (ev.type === "removed") {
					debug("Event: removed id=%d", id);
					if (id != null && this.activeMicStreams.has(id)) {
						const name = this.activeMicStreams.get(id);
						this.activeMicStreams.delete(id);
						debug(
							"Removed stream %d (%s), %d active mics remain",
							id,
							name,
							this.activeMicStreams.size,
						);
						this.maybeEmitChange(`event: removed stream ${id} (${name})`);
					}
					return;
				}

				// Added or changed event - update or remove based on current media.class
				if (ev.type === "added" || ev.type === "changed") {
					if (ev.object && ev.object.id != null) {
						const isMic =
							ev.object.info?.props?.["media.class"] === MEDIA_CLASS_MIC_INPUT;
						const appName =
							ev.object.info?.props?.["application.name"] ??
							ev.object.info?.props?.["node.name"] ??
							"Unknown";
						const mediaClass = ev.object.info?.props?.["media.class"];

						debug(
							"Event: %s id=%d class=%s app=%s isMic=%s",
							ev.type,
							ev.object.id,
							mediaClass,
							appName,
							isMic,
						);

						if (isMic) {
							// Stream is (now) a mic - add or update it
							const wasPresent = this.activeMicStreams.has(ev.object.id);
							this.activeMicStreams.set(ev.object.id, appName);
							debug(
								"%s mic stream %d, %d active mics",
								wasPresent ? "Updated" : "Added",
								ev.object.id,
								this.activeMicStreams.size,
							);
							this.maybeEmitChange(
								`event: ${ev.type} mic stream ${ev.object.id} (${appName})`,
							);
						} else {
							// Stream is NOT a mic - if we were tracking it, remove it (class changed)
							if (id != null && this.activeMicStreams.has(id)) {
								const name = this.activeMicStreams.get(id);
								this.activeMicStreams.delete(id);
								debug(
									"Removed non-mic stream %d (%s), %d active mics remain",
									id,
									name,
									this.activeMicStreams.size,
								);
								this.maybeEmitChange(
									`event: ${ev.type} non-mic stream ${id} changed class to ${mediaClass}`,
								);
							}
						}
					}
					return;
				}
			}

			const obj = msg as PipeWireObject;
			if (obj && typeof obj === "object" && typeof obj.id === "number") {
				debug("Single object: id=%d", obj.id);
				this.maybeTrackObject(obj, true);
				this.maybeEmitChange(`single object ${obj.id}`);
			}
		} catch (error) {
			console.error("Error handling PipeWire message:", error);
		}
	}

	/**
	 * Tracks or removes a PipeWire object based on its media.class.
	 *
	 * @param obj The PipeWire object to track
	 * @param authoritative If true, the object's presence in the message is
	 *                      authoritative - if the object exists in activeMicStreams
	 *                      but is NOT a mic stream (mediaClass !== MEDIA_CLASS_MIC_INPUT),
	 *                      it will be removed. This should be true for objects from
	 *                      array dumps (partial batches) and false for standalone objects.
	 *
	 * CRITICAL: pw-dump --monitor sends PARTIAL batches, not full snapshots.
	 * An active mic stream may be absent from an array dump. Therefore, we ONLY
	 * remove streams when:
	 * 1. They appear in an array WITH a different (non-mic) media.class
	 * 2. They appear in an array WITH undefined media.class (stream shutting down)
	 * 3. An explicit 'removed' event is received (handled in handleMessage)
	 *
	 * We do NOT remove streams that are simply absent from partial batches.
	 */
	private maybeTrackObject(obj: PipeWireObject, authoritative: boolean): void {
		const mediaClass = obj.info?.props?.["media.class"];
		const appName =
			obj.info?.props?.["application.name"] ?? obj.info?.props?.["node.name"];

		// If this is a mic stream, add/update it
		if (mediaClass === MEDIA_CLASS_MIC_INPUT) {
			const wasPresent = this.activeMicStreams.has(obj.id);
			this.activeMicStreams.set(obj.id, appName ?? "Unknown");
			if (!wasPresent) {
				debug("✓ Added mic stream %d (%s)", obj.id, appName ?? "Unknown");
			}
			return;
		}

		// If authoritative and this object is NOT a mic stream (but was previously tracked),
		// remove it. This handles class changes (mic -> non-mic) or undefined class (shutdown).
		// BUG FIX: Removed `mediaClass !== undefined` check - undefined class means
		// the stream is shutting down and should be removed.
		if (authoritative && this.activeMicStreams.has(obj.id)) {
			const name = this.activeMicStreams.get(obj.id);
			this.activeMicStreams.delete(obj.id);
			debug(
				"✗ Removed stream %d (%s) - class changed to %s",
				obj.id,
				name,
				mediaClass ?? "undefined",
			);
		}
	}

	private maybeEmitChange(reason: string): void {
		const isActive = this.activeMicStreams.size > 0;
		const streamIds = Array.from(this.activeMicStreams.keys());
		debug(
			"maybeEmitChange: isActive=%s last=%s reason=%s streams=[%s]",
			isActive,
			this.lastEmittedActive,
			reason,
			streamIds.join(","),
		);
		if (isActive !== this.lastEmittedActive) {
			const statusText = isActive ? "ACTIVE" : "INACTIVE";
			const color = isActive ? "\x1b[32m" : "\x1b[31m";
			const reset = "\x1b[0m";

			if (isActive) {
				const appName = this.activeMicStreams.values().next().value;
				console.log(
					`${color}[PW] 🔔 ${statusText}${reset} app=${appName} (${reason})`,
				);
				this.onMicChanged(true, appName);
			} else {
				console.log(`${color}[PW] 🔔 ${statusText}${reset} (${reason})`);
				this.onMicChanged(false);
			}

			this.lastEmittedActive = isActive;
		}
	}

	/**
	 * Stops the PipeWire monitor and cleans up resources.
	 *
	 * Kills the subprocess and resets internal state.
	 */
	stop(): void {
		if (this.process) {
			this.process.kill();
			this.process = null;
		}
		this.activeMicStreams.clear();
		this.lastEmittedActive = false;
	}
}
