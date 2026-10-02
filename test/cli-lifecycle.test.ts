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
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
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
      },
    });
    try {
      const output = await result(
        cli({ ...box.env, AWTRIX_HOST: `127.0.0.1:${server.port}` }),
      );
      expect(output.code).toBe(0);
      expect(completed).toEqual([
        { text: "ON AIR", color: "#FF0000", icon: "liveonair" },
        {},
      ]);
      if (status === 503)
        expect(output.stderr).toContain("Failed to update Awtrix display:");
    } finally {
      server.stop(true);
      await box.dispose();
    }
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  test(`${signal} reaps pw-dump and jq, drains HTTP and clears the display`, async () => {
    const box = await sandbox(`
console.log(${JSON.stringify(JSON.stringify([mic(17, "Recorder")]))});
setInterval(() => {}, 1000);
`);
    const ready = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const stopping = Promise.withResolvers<void>();
    const completed: unknown[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        if (request.method === "GET") return Response.json([]);
        const body = await request.json();
        if (body && typeof body === "object" && "text" in body) {
          ready.resolve();
          await release.promise;
        }
        completed.push(body);
        return Response.json({});
      },
    });
    const proc = cli({ ...box.env, AWTRIX_HOST: `127.0.0.1:${server.port}` });
    const output = result(proc, (text) => {
      if (text.includes("Stopping monitor")) stopping.resolve();
    });
    let children: number[] = [];
    try {
      await ready.promise;
      children = (
        await Bun.file(`/proc/${proc.pid}/task/${proc.pid}/children`).text()
      )
        .trim()
        .split(/\s+/)
        .map(Number);
      expect(children).toHaveLength(2);
      proc.kill(signal);
      await stopping.promise;
      proc.kill("SIGTERM");
      release.resolve();
      expect(await proc.exited).toBe(0);
      for (const pid of children) expect(() => process.kill(pid, 0)).toThrow();
      expect((await output).stdout).toContain("Stopping monitor");
      expect(completed).toEqual([
        { text: "ON AIR", color: "#FF0000", icon: "liveonair" },
        {},
      ]);
    } finally {
      release.resolve();
      if (proc.exitCode === null) proc.kill("SIGKILL");
      for (const pid of children) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
      await output;
      server.stop(true);
      await box.dispose();
    }
  });
}

test("SIGTERM during startup skips spawning and reports failed shutdown cleanup", async () => {
  const box = await sandbox(
    'await Bun.write(import.meta.dir + "/started", "yes")',
  );
  const ready = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const stopping = Promise.withResolvers<void>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (request.method === "GET") {
        ready.resolve();
        await release.promise;
        return Response.json([]);
      }
      return new Response("unavailable", { status: 503 });
    },
  });
  const proc = cli({ ...box.env, AWTRIX_HOST: `127.0.0.1:${server.port}` });
  const output = result(proc, (text) => {
    if (text.includes("Stopping monitor")) stopping.resolve();
  });
  try {
    await ready.promise;
    proc.kill("SIGTERM");
    await stopping.promise;
    release.resolve();
    const completed = await output;
    expect(completed.code).toBe(0);
    expect(completed.stderr).toContain("Failed to clear Awtrix display:");
    expect(await Bun.file(`${box.directory}/started`).exists()).toBe(false);
  } finally {
    release.resolve();
    if (proc.exitCode === null) proc.kill("SIGKILL");
    await output;
    server.stop(true);
    await box.dispose();
  }
});
