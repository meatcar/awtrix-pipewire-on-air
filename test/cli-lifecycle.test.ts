import { expect, test } from "bun:test";
import { cli, mic, result, sandbox } from "./runtime-helpers.ts";

for (const status of [200, 503]) {
  test(`serializes delayed display updates and drains them at EOF (${status})`, async () => {
    const box = await sandbox(`
console.log(${JSON.stringify(JSON.stringify([mic(17, "Recorder")]))});
while (!(await Bun.file(import.meta.dir + "/release").exists())) await Bun.sleep(1);
console.log(JSON.stringify({type: "removed", id: 17}));
`);
    const completed: unknown[] = [];
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
      if (request.method === "GET") return Response.json([]);
      const body = await request.json();
      if (body && typeof body === "object" && "text" in body) {
        await Bun.write(`${box.directory}/release`, "go");
        await Bun.sleep(100);
        completed.push(body);
        return new Response("", { status });
      }
      completed.push(body);
      return Response.json({});
    } });
    try {
      const output = await result(cli({ ...box.env, AWTRIX_HOST: `127.0.0.1:${server.port}` }));
      expect(output.code).toBe(0);
      expect(completed).toEqual([{ text: "ON AIR", color: "#FF0000", icon: "liveonair" }, {}]);
      if (status === 503) expect(output.stderr).toContain("Failed to update Awtrix display:");
    } finally { server.stop(true); await box.dispose(); }
  });
}
