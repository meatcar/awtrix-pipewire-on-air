import { expect, test } from "bun:test";
import { join } from "node:path";

import { cli, mic, result, sandbox } from "./runtime-helpers.ts";

test("CLI help, missing host and unknown arguments exit without hardware", async () => {
  const box = await sandbox();
  try {
    const help = await result(cli(box.env, ["--help"]));
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("Usage:");
    const missing = await result(cli(box.env));
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("AWTRIX_HOST");
    expect((await result(cli(box.env, ["--unknown"]))).code).toBe(1);
  } finally {
    await box.dispose();
  }
});

test("CLI fixtures do not load dotenv configuration", async () => {
  const box = await sandbox();
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      requests++;
      return Response.json([]);
    },
  });
  try {
    await Bun.write(
      join(box.directory, ".env"),
      `AWTRIX_HOST=127.0.0.1:${server.port}\n`,
    );
    const missing = await result(cli(box.env));
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("AWTRIX_HOST");
    expect(requests).toBe(0);
  } finally {
    server.stop(true);
    await box.dispose();
  }
});

test("CLI resolves defaults, TOML, environment and CLI in order", async () => {
  const box = await sandbox();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => Response.json([]),
  });
  const host = `127.0.0.1:${server.port}`;
  try {
    const defaults = await result(cli({ ...box.env, AWTRIX_HOST: host }));
    expect(defaults.code).toBe(0);
    expect(defaults.stdout).toContain("Ignored apps: cava, pavucontrol");
    expect(defaults.stdout).toContain("On air text: ON AIR");
    expect(defaults.stdout).toContain("On air icon: liveonair");
    expect(defaults.stdout).toContain("On air color: #FF0000");
    await Bun.write(
      join(box.directory, "awtrix-pipewire-on-air/config.toml"),
      `awtrixHost = "${host}"
ignoreApps = []
logIgnoredApps = true
onAirText = "file"
onAirIcon = "file-icon"
onAirColor = "#111111"
`,
    );
    const file = await result(cli(box.env));
    expect(file.code).toBe(0);
    expect(file.stdout).toContain("Ignored apps: none");
    expect(file.stdout).toContain("Log ignored apps: yes");
    expect(file.stdout).toContain("On air text: file");
    const env = {
      ...box.env,
      AWTRIX_HOST: host,
      AWTRIX_IGNORE_APPS: "Env, Second",
      AWTRIX_LOG_IGNORED: "false",
      AWTRIX_TEXT: "env",
      AWTRIX_ICON: "env-icon",
      AWTRIX_COLOR: "#222222",
    };
    const environment = await result(cli(env));
    expect(environment.code).toBe(0);
    expect(environment.stdout).toContain("Ignored apps: Env, Second");
    expect(environment.stdout).toContain("Log ignored apps: no");
    expect(environment.stdout).toContain("On air text: env");
    expect(environment.stdout).toContain("On air icon: env-icon");
    expect(environment.stdout).toContain("On air color: #222222");
    const flags = await result(
      cli({ ...env, AWTRIX_HOST: "invalid" }, [
        "--awtrix-host",
        host,
        "-i",
        " CLI , Other ",
        "--log-ignored",
        "--text",
        "cli",
        "--icon",
        "cli-icon",
        "--color",
        "#333333",
      ]),
    );
    expect(flags.code).toBe(0);
    expect(flags.stdout).toContain(`Awtrix host: ${host}`);
    expect(flags.stdout).toContain("Ignored apps: CLI, Other");
    expect(flags.stdout).toContain("Log ignored apps: yes");
    expect(flags.stdout).toContain("On air text: cli");
    expect(flags.stdout).toContain("On air icon: cli-icon");
    expect(flags.stdout).toContain("On air color: #333333");
  } finally {
    server.stop(true);
    await box.dispose();
  }
});

test("CLI uses HOME config fallback and reports malformed TOML before using defaults", async () => {
  const box = await sandbox();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => Response.json([]),
  });
  const host = `127.0.0.1:${server.port}`;
  const path = join(
    box.directory,
    ".config/awtrix-pipewire-on-air/config.toml",
  );
  try {
    await Bun.write(path, `awtrixHost = "${host}"\nonAirText = "home"\n`);
    const home = await result(cli({ PATH: box.env.PATH, HOME: box.directory }));
    expect(home.code).toBe(0);
    expect(home.stdout).toContain("On air text: home");
    expect(home.stdout).toContain("Ignored apps: cava, pavucontrol");
    await Bun.write(path, "onAirText = [broken");
    const malformed = await result(
      cli({ PATH: box.env.PATH, HOME: box.directory, AWTRIX_HOST: host }),
    );
    expect(malformed.code).toBe(0);
    expect(malformed.stderr).toContain("Error loading config:");
    expect(malformed.stdout).toContain("On air text: ON AIR");
  } finally {
    server.stop(true);
    await box.dispose();
  }
});

test("importing the entry point does not start the CLI", async () => {
  const box = await sandbox();
  try {
    const proc = Bun.spawn(
      [
        process.execPath,
        "--no-env-file",
        "-e",
        `await import(${JSON.stringify(join(import.meta.dir, "../index.ts"))}); console.log("imported")`,
      ],
      {
        cwd: join(box.directory, "work"),
        env: box.env,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(await result(proc)).toEqual({
      code: 0,
      stdout: "imported\n",
      stderr: "",
    });
  } finally {
    await box.dispose();
  }
});

test("empty CLI and environment ignore lists override lower-precedence lists", async () => {
  const box = await sandbox(
    `console.log(${JSON.stringify(JSON.stringify([mic(17, "cava")]))});`,
  );
  const messages: unknown[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (request.method === "POST") messages.push(await request.json());
      return Response.json([]);
    },
  });
  const env = {
    ...box.env,
    AWTRIX_HOST: `127.0.0.1:${server.port}`,
    AWTRIX_IGNORE_APPS: "cava",
  };
  try {
    const flags = await result(cli(env, ["--ignore-apps", ""]));
    expect(flags.code).toBe(0);
    expect(flags.stdout).toContain("Ignored apps: none");
    expect(messages).toHaveLength(1);
    messages.length = 0;
    const environment = await result(cli({ ...env, AWTRIX_IGNORE_APPS: "" }));
    expect(environment.code).toBe(0);
    expect(environment.stdout).toContain("Ignored apps: none");
    expect(messages).toHaveLength(1);
    messages.length = 0;
    const blanks = await result(cli(env, ["-i", " , , "]));
    expect(blanks.code).toBe(0);
    expect(blanks.stdout).toContain("Ignored apps: none");
    expect(messages).toHaveLength(1);
  } finally {
    server.stop(true);
    await box.dispose();
  }
});
