import { expect, test } from "bun:test";

import { AwtrixClient } from "../src/awtrix-client.ts";

test("Awtrix sends configured JSON and clears only its existing app", async () => {
  const requests: Array<{
    method: string;
    path: string;
    body: unknown;
    contentType: string | null;
  }> = [];
  let apps = [{ name: "weather" }];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests.push({
        method: request.method,
        path: new URL(request.url).pathname + new URL(request.url).search,
        body: request.method === "POST" ? await request.json() : null,
        contentType: request.headers.get("content-type"),
      });
      return Response.json(apps);
    },
  });
  try {
    const client = new AwtrixClient(
      `127.0.0.1:${server.port}`,
      "Émission 🎙",
      "#123456",
      "42",
    );
    await client.ensureCleanState();
    expect(requests).toHaveLength(1);
    apps = [{ name: "onair" }, { name: "weather" }];
    await client.ensureCleanState();
    await client.showOnAir();
    await client.hideOnAir();
    expect(
      requests.map(({ method, path, body }) => ({ method, path, body })),
    ).toEqual([
      { method: "GET", path: "/api/apps", body: null },
      { method: "GET", path: "/api/apps", body: null },
      { method: "POST", path: "/api/custom?name=onair", body: {} },
      {
        method: "POST",
        path: "/api/custom?name=onair",
        body: { text: "Émission 🎙", color: "#123456", icon: "42" },
      },
      { method: "POST", path: "/api/custom?name=onair", body: {} },
    ]);
    expect(
      requests
        .slice(2)
        .every((request) => request.contentType === "application/json"),
    ).toBe(true);
  } finally {
    server.stop(true);
  }
});

test("Awtrix rejects HTTP failures and malformed app-list JSON", async () => {
  let status = 503;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("not JSON", { status }),
  });
  try {
    const client = new AwtrixClient(`127.0.0.1:${server.port}`);
    await expect(client.showOnAir()).rejects.toThrow("503");
    await expect(client.hideOnAir()).rejects.toThrow("503");
    await expect(client.ensureCleanState()).rejects.toThrow("503");
    status = 200;
    await expect(client.ensureCleanState()).rejects.toThrow();
  } finally {
    server.stop(true);
  }
});
