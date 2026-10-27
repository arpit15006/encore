import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

interface Reply {
  id?: number;
  ready?: boolean;
  code?: number;
  stdout?: string;
  stderr?: string;
}

/** The worker itself failed (not a Qloo error): callers fall back to running the CLI directly. */
export class WorkerUnavailable extends Error {}

const WORKER = fileURLToPath(new URL("./insightsWorkerProcess.js", import.meta.url));

/**
 * Runs `qloo api …` commands in one long-lived child process (see insightsWorkerProcess.ts).
 * If the child dies it is restarted on the next call.
 */
export class InsightsWorker {
  private child?: ChildProcess;
  private ready?: Promise<void>;
  private nextId = 1;
  private pending = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void }>();

  /** Starts the child and waits until the harness has loaded. Safe to call repeatedly. */
  start(): Promise<void> {
    if (this.ready) return this.ready;
    const child = fork(WORKER, [], { env: process.env, stdio: ["ignore", "ignore", "pipe", "ipc"] });
    this.child = child;
    this.ready = new Promise<void>((resolve, reject) => {
      const onFirst = (reply: Reply) => {
        if (reply.ready) {
          child.off("message", onFirst);
          resolve();
        }
      };
      child.on("message", onFirst);
      child.once("exit", () => reject(new WorkerUnavailable("insights worker exited while starting")));
    });
    child.on("message", (reply: Reply) => {
      if (reply.id == null) return;
      this.pending.get(reply.id)?.resolve(reply);
      this.pending.delete(reply.id);
    });
    child.once("exit", () => {
      for (const { reject } of this.pending.values()) reject(new WorkerUnavailable("insights worker exited"));
      this.pending.clear();
      this.child = undefined;
      this.ready = undefined;
    });
    this.ready.catch(() => undefined);
    return this.ready;
  }

  /** Runs one command and returns its stdout; throws on a non-zero exit, like execFile. */
  async run(args: string[], timeoutMs: number): Promise<string> {
    await this.start();
    const child = this.child;
    if (!child?.connected) throw new WorkerUnavailable("insights worker is not connected");
    const id = this.nextId++;
    const reply = await new Promise<Reply>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`qloo api timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => (clearTimeout(timer), resolve(value)),
        reject: (error) => (clearTimeout(timer), reject(error)),
      });
      child.send({ id, args });
    });
    if (reply.code !== 0) throw new Error(`qloo api failed (exit ${reply.code}): ${reply.stderr ?? ""}`.trim());
    return reply.stdout ?? "";
  }

  close(): void {
    this.child?.kill();
    this.child = undefined;
    this.ready = undefined;
  }
}
