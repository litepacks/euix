import { spawn } from "node:child_process";

export function execNodeScript(
    script: string,
    args: string[],
    options: { cwd: string; input?: string; maxBuffer?: number },
): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, ...args], {
            cwd: options.cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env: process.env,
        });

        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let stdoutLen = 0;
        const maxBuffer = options.maxBuffer ?? 32 * 1024 * 1024;

        child.stdout.on("data", (chunk: Buffer) => {
            stdoutLen += chunk.length;
            if (stdoutLen > maxBuffer) {
                child.kill();
                reject(new Error("stdout maxBuffer exceeded"));
                return;
            }
            stdout.push(chunk);
        });
        child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

        child.on("error", reject);
        child.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(Buffer.concat(stderr).toString("utf8") || `Process exited with code ${code}`));
                return;
            }
            resolve(Buffer.concat(stdout).toString("utf8"));
        });

        if (options.input) child.stdin.write(options.input);
        child.stdin.end();
    });
}
