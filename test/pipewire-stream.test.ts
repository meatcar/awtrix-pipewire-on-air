import { expect, test } from "bun:test";
import { PipeWireMonitor } from "../src/pipewire-monitor.ts";
import { cli, mic, result, root, sandbox } from "./runtime-helpers.ts";

test("replays captured dumps as deltas through pw-dump and jq", async () => {
  const box = await sandbox(`
for (const name of ["idle", "mic-active-single", "idle", "mic-active-multiple"]) {
  console.log(await Bun.file(${JSON.stringify(root)} + "/test/fixtures/" + name + ".json").text());
}
`);
  const messages: unknown[] = [];
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    if (request.method === "POST") messages.push(await request.json());
    return Response.json([]);
  } });
  try {
    const output = await result(cli({ ...box.env, AWTRIX_HOST: `127.0.0.1:${server.port}` }));
    expect(output.code).toBe(0);
    expect(output.stdout).toContain("app=PipeWire ALSA [.aplay-wrapped]");
    expect(messages).toEqual([{text: "ON AIR", color: "#FF0000", icon: "liveonair"}]);
  } finally { server.stop(true); await box.dispose(); }
});

test("stop reaps the child, rejects overlapping starts and allows restart", async () => {
  const box = await sandbox();
  const ready = Promise.withResolvers<void>();
  const monitor = new PipeWireMonitor(() => { ready.resolve(); }, [], false);
  const pidPath = `${box.directory}/pid`;
  const running = monitor.start([process.execPath, "-e", `
await Bun.write(${JSON.stringify(pidPath)}, String(process.pid));
console.log(${JSON.stringify(JSON.stringify([mic(17, "Recorder")]))});
setInterval(() => {}, 1000);
`]);
  try {
    await ready.promise;
    const pid = Number(await Bun.file(pidPath).text());
    await expect(monitor.start([process.execPath, "-e", ""])).rejects.toThrow("already running");
    await monitor.stop();
    await running;
    expect(() => process.kill(pid, 0)).toThrow();
    await monitor.stop();
    await expect(monitor.start([`${box.directory}/missing`])).rejects.toThrow();
    await monitor.start([process.execPath, "-e", "void 0"]);
  } finally { await monitor.stop(); await running; await box.dispose(); }
});

test("CLI reports jq parse failures", async () => {
  const box = await sandbox('console.log("{invalid JSON}")');
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => Response.json([]) });
  try {
    const output = await result(cli({ ...box.env, AWTRIX_HOST: `127.0.0.1:${server.port}` }));
    expect(output.code).toBe(1);
    expect(output.stderr).toContain("jq: parse error:");
    expect(output.stderr).toMatch(/subprocess exited with code [1-9]/);
  } finally { server.stop(true); await box.dispose(); }
});

test("decodes fragmented Unicode and recovers after malformed JSON lines", async () => {
  const changes: Array<[boolean, string | undefined]> = [];
  const monitor = new PipeWireMonitor((active, name) => { changes.push([active, name]); }, [], false);
  const input = `\n${JSON.stringify([mic(17, "Émission 🎙")])}\n{bad json}\n${JSON.stringify([{id: 999}])}\n${JSON.stringify({type: "removed", id: 17})}\n`;
  await monitor.start([process.execPath, "-e", `
import { writeSync } from "node:fs";
const bytes = new TextEncoder().encode(${JSON.stringify(input)});
for (const byte of bytes) {
  writeSync(1, new Uint8Array([byte]));
  await Bun.sleep(1);
}
`]);
  expect(changes).toEqual([[true, "Émission 🎙"], [false, undefined]]);
});

test("processes the final JSON message without a newline at EOF", async () => {
  const changes: Array<[boolean, string | undefined]> = [];
  const monitor = new PipeWireMonitor((active, name) => { changes.push([active, name]); }, [], false);
  const input = `${JSON.stringify([mic(17, "Recorder")])}\n${JSON.stringify({type: "removed", id: 17})}`;
  await monitor.start([process.execPath, "-e", `process.stdout.write(${JSON.stringify(input)})`]);
  expect(changes).toEqual([[true, "Recorder"], [false, undefined]]);
});

test("reports failed child exit status and can restart without stale mic state", async () => {
  const changes: boolean[] = [];
  const monitor = new PipeWireMonitor((active) => { changes.push(active); }, [], false);
  const source = `console.log(${JSON.stringify(JSON.stringify([mic(17, "Recorder")]))}); process.exit(7)`;
  await expect(monitor.start([process.execPath, "-e", source])).rejects.toThrow("code 7");
  await monitor.start([process.execPath, "-e", `console.log(${JSON.stringify(JSON.stringify([mic(17, "Recorder")]))})`]);
  expect(changes).toEqual([true, true]);
});

test("CLI reports pw-dump failure even when jq exits successfully", async () => {
  const box = await sandbox('process.exit(23)');
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => Response.json([]) });
  try {
    const output = await result(cli({ ...box.env, AWTRIX_HOST: `127.0.0.1:${server.port}` }));
    expect(output.code).toBe(1);
    expect(output.stderr).toContain("code 23");
  } finally { server.stop(true); await box.dispose(); }
});
