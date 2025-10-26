import { describe, test, expect, beforeEach, mock } from "bun:test";
import { readFileSync } from "fs";
import { PipeWireMonitor } from "./pipewire-monitor.ts";

function loadFixture(name: string): unknown[] {
	const content = readFileSync(`test/fixtures/${name}.json`, "utf-8");
	return JSON.parse(content);
}

describe("PipeWireMonitor", () => {
	let callbackMock: ReturnType<typeof mock>;
	let monitor: PipeWireMonitor;

	beforeEach(() => {
		callbackMock = mock(() => {});
		monitor = new PipeWireMonitor(callbackMock);
	});

	test("idle state has no active microphones", () => {
		const idleData = loadFixture("idle");
		(monitor as any).handleDump(idleData);
		(monitor as any).flushPendingState();

		expect(callbackMock).not.toHaveBeenCalled();
	});

	test("detects microphone activation", async () => {
		const idleData = loadFixture("idle");
		const activeData = loadFixture("mic-active-single");

		(monitor as any).handleDump(idleData);
		(monitor as any).flushPendingState();

		(monitor as any).handleDump(activeData);
		(monitor as any).flushPendingState();

		expect(callbackMock).toHaveBeenCalledTimes(1);
		expect(callbackMock).toHaveBeenCalledWith(true, "PipeWire ALSA [.aplay-wrapped]");
	});

	test("detects microphone deactivation", () => {
		const activeData = loadFixture("mic-active-single");
		const idleData = loadFixture("idle");

		(monitor as any).handleDump(activeData);
		(monitor as any).flushPendingState();

		(monitor as any).handleDump(idleData);
		(monitor as any).flushPendingState();

		expect(callbackMock).toHaveBeenCalledTimes(2);
		expect(callbackMock).toHaveBeenNthCalledWith(1, true, "PipeWire ALSA [.aplay-wrapped]");
		expect(callbackMock).toHaveBeenNthCalledWith(2, false);
	});

	test("handles multiple apps using microphone", () => {
		const idleData = loadFixture("idle");
		const multipleData = loadFixture("mic-active-multiple");

		(monitor as any).handleDump(idleData);
		(monitor as any).flushPendingState();

		(monitor as any).handleDump(multipleData);
		(monitor as any).flushPendingState();

		expect(callbackMock).toHaveBeenCalledTimes(1);
		expect(callbackMock).toHaveBeenCalledWith(true, expect.any(String));
	});

	test("does not trigger callback if state unchanged", () => {
		const activeData = loadFixture("mic-active-single");

		(monitor as any).handleDump(activeData);
		(monitor as any).flushPendingState();

		(monitor as any).handleDump(activeData);
		(monitor as any).flushPendingState();

		expect(callbackMock).toHaveBeenCalledTimes(1);
	});

	test("debounce prevents rapid state changes", async () => {
		const idleData = loadFixture("idle");
		const activeData = loadFixture("mic-active-single");

		(monitor as any).handleDump(activeData);
		(monitor as any).flushPendingState();

		(monitor as any).handleDump(idleData);
		(monitor as any).handleDump(activeData);
		(monitor as any).handleDump(idleData);

		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(callbackMock).toHaveBeenCalledTimes(2);
		expect(callbackMock).toHaveBeenNthCalledWith(1, true, "PipeWire ALSA [.aplay-wrapped]");
		expect(callbackMock).toHaveBeenNthCalledWith(2, false);
	});
});
