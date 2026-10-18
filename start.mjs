#!/usr/bin/env node
// Cross-platform launcher for Lao Gan Ma.
// Delegates to run.ps1 on Windows and run.sh on macOS/Linux.
// Usage:  npm start   |   npm run install-deps
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const passthrough = process.argv.slice(2); // e.g. --install / --force

let cmd, args;
if (process.platform === "win32") {
  cmd = "powershell";
  args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "run.ps1"), ...passthrough];
} else {
  cmd = "bash";
  args = [join(root, "run.sh"), ...passthrough];
}

const child = spawn(cmd, args, { stdio: "inherit", cwd: root });
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error(`Failed to launch (${cmd}):`, err.message);
  process.exit(1);
});
