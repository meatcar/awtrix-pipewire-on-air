#!/usr/bin/env bun
import { $ } from "bun";
import { readFileSync, writeFileSync } from "fs";
import type { Subprocess } from "bun";

const FIXTURE_DIR = import.meta.dir;

function sanitizeObject(obj: any): any {
	if (typeof obj !== "object" || obj === null) return obj;

	if (Array.isArray(obj)) {
		return obj.map(sanitizeObject);
	}

	const sanitized: any = {};
	for (const [key, value] of Object.entries(obj)) {
		if (
			key === "user-name" ||
			key === "host-name" ||
			key === "application.process.user" ||
			key === "application.process.host"
		) {
			sanitized[key] = "<REDACTED>";
		} else {
			sanitized[key] = sanitizeObject(value);
		}
	}
	return sanitized;
}

function filterRelevantData(data: any[]): any[] {
	const filtered = data.filter(
		(obj: any) =>
			obj.info?.props?.["media.class"] === "Stream/Input/Audio" ||
			obj.type === "PipeWire:Interface:Core",
	);
	return filtered.map(sanitizeObject);
}

async function captureFixture(
	name: string,
	description: string,
	expectedStreams: number,
	arecordProcesses: Subprocess[] = [],
): Promise<void> {
	console.log(`📝 Capturing: ${name}`);
	console.log(`   ${description}`);
	console.log("");

	if (arecordProcesses.length > 0) {
		console.log(
			`   Starting ${arecordProcesses.length} arecord process(es)...`,
		);
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	await $`pw-dump | jq -c '.' > ${FIXTURE_DIR}/${name}.json`;

	const content = readFileSync(`${FIXTURE_DIR}/${name}.json`, "utf-8");
	let data = JSON.parse(content);
	data = filterRelevantData(data);

	writeFileSync(
		`${FIXTURE_DIR}/${name}.json`,
		JSON.stringify(data, null, 2),
		"utf-8",
	);

	const streams = data.filter(
		(obj: any) => obj.info?.props?.["media.class"] === "Stream/Input/Audio",
	);
	const count = streams.length;

	console.log(
		`   ✓ Captured ${name}.json (${count} Stream/Input/Audio entries, ${data.length} total objects)`,
	);

	if (count !== expectedStreams) {
		console.log(
			`   ⚠️  Warning: Expected ${expectedStreams} streams, got ${count}`,
		);
	}

	console.log("");
}

async function main() {
	console.log("PipeWire Test Fixture Capture Script");
	console.log("=====================================");
	console.log("");
	console.log("This script will automatically capture PipeWire states");
	console.log("using arecord to simulate microphone usage.");
	console.log("");

	console.log("Step 1/3: Idle State");
	console.log("──────────────────────");
	console.log("Capturing with no microphone activity...");
	console.log("");
	await captureFixture("idle", "No microphone usage", 0);

	console.log("Step 2/3: Single Microphone User");
	console.log("─────────────────────────────────");
	const arecord1 = Bun.spawn(["arecord", "-f", "cd", "-t", "raw"], {
		stdout: "ignore",
		stderr: "ignore",
	});
	const arecordProcesses = [arecord1];

	try {
		await captureFixture(
			"mic-active-single",
			"One app using microphone (arecord)",
			1,
			arecordProcesses,
		);

		console.log("Step 3/3: Multiple Microphone Users");
		console.log("────────────────────────────────────");
		const arecord2 = Bun.spawn(["arecord", "-f", "cd", "-t", "raw"], {
			stdout: "ignore",
			stderr: "ignore",
		});
		arecordProcesses.push(arecord2);

		await captureFixture(
			"mic-active-multiple",
			"Multiple apps using microphone (2x arecord)",
			2,
			arecordProcesses,
		);

		arecord2.kill();
	} finally {
		arecord1.kill();
	}

	console.log("════════════════════════════════════");
	console.log("✓ All fixtures captured successfully!");
	console.log("");
	console.log("Verify the captures:");

	for (const file of [
		"idle.json",
		"mic-active-single.json",
		"mic-active-multiple.json",
	]) {
		const content = readFileSync(`${FIXTURE_DIR}/${file}`, "utf-8");
		const data = JSON.parse(content);
		const streams = data
			.filter(
				(obj: any) =>
					obj.info?.props?.["media.class"] === "Stream/Input/Audio",
			)
			.map((obj: any) => ({
				id: obj.id,
				app: obj.info?.props?.["application.name"],
				node: obj.info?.props?.["node.name"],
			}));

		console.log(`${file}:`, streams.length ? streams : "No streams");
	}

	console.log("");
	console.log("Run tests with: bun test");
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
