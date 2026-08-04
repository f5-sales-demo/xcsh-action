import { spawn } from "node:child_process";

export interface ProcessResult {
  exitCode: number;
  signal?: NodeJS.Signals;
}

export async function runExecutable(
  executable: string,
  arguments_: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<ProcessResult> {
  return await new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.once("error", reject);
    child.once("close", (code, signal) => {
      const result: ProcessResult = { exitCode: code ?? 1 };
      if (signal) result.signal = signal;
      resolve(result);
    });
  });
}
