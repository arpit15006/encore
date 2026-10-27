// Child process: loads Qloo's official harness once and runs `qloo api …` commands inside it, one at a
// time. Starting the `qloo` CLI costs about 20 seconds on a 0.1-CPU host; loading it once removes that
// cost from every request. It is the same harness code, configuration and credential as the CLI.
import { existsSync, realpathSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

interface Job {
  id: number;
  args: string[];
}

/** The harness's package entry, found from the `qloo` binary on PATH (global npm installs vary). */
function harnessEntry(): string {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const bin = join(dir, "qloo");
    if (existsSync(bin)) return join(dirname(realpathSync(bin)), "index.js");
  }
  throw new Error("qloo is not on PATH");
}

const harness = (await import(pathToFileURL(harnessEntry()).href)) as { runQloo: (argv: readonly string[]) => Promise<number> };

let queue: Promise<void> = Promise.resolve();
process.on("message", (job: Job) => {
  queue = queue.then(async () => {
    const out: string[] = [];
    const err: string[] = [];
    const writeOut = process.stdout.write;
    const writeErr = process.stderr.write;
    // Jobs run one at a time, so capturing the process's output is safe.
    process.stdout.write = ((chunk: string | Uint8Array) => (out.push(String(chunk)), true)) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => (err.push(String(chunk)), true)) as typeof process.stderr.write;
    let code = 1;
    try {
      code = await harness.runQloo(job.args);
    } catch (error) {
      err.push(error instanceof Error ? error.message : String(error));
    } finally {
      process.stdout.write = writeOut;
      process.stderr.write = writeErr;
    }
    process.send?.({ id: job.id, code, stdout: out.join(""), stderr: err.join("").slice(0, 2000) });
  });
});
process.send?.({ ready: true });
