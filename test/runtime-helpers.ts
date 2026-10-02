import { mkdtemp, chmod, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const root = join(import.meta.dir, "..");

export async function sandbox(source = "") {
  const directory = await mkdtemp(join(tmpdir(), "awtrix-test-"));
  await mkdir(join(directory, "work"));
  const executable = join(directory, "pw-dump");
  await Bun.write(executable, `#!${process.execPath}\n${source}\n`);
  await chmod(executable, 0o755);
  return {
    directory,
    env: {
      PATH: `${directory}:${process.env.PATH}`,
      HOME: directory,
      XDG_CONFIG_HOME: directory,
    },
    dispose: () => rm(directory, { recursive: true, force: true }),
  };
}

export function cli(
  env: Record<string, string> & { HOME: string },
  args: string[] = [],
) {
  const command = [process.execPath, "--no-env-file", join(root, "index.ts")];
  return Bun.spawn([...command, ...args], {
    cwd: join(env.HOME, "work"),
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
}

export async function result(
  proc: ReturnType<typeof cli>,
  onStdout?: (output: string) => void,
) {
  const readStdout = async () => {
    const decoder = new TextDecoder();
    let output = "";
    for await (const chunk of proc.stdout) {
      output += decoder.decode(chunk, { stream: true });
      onStdout?.(output);
    }
    return output + decoder.decode();
  };
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    readStdout(),
    new Response(proc.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

export const mic = (id: number, name: string) => ({
  id,
  type: "PipeWire:Interface:Node",
  info: {
    props: {
      "media.class": "Stream/Input/Audio",
      "application.name": name,
    },
  },
});
