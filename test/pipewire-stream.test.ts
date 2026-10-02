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
