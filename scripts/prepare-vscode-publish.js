#!/usr/bin/env node
import { execSync } from "node:child_process";

const root = process.cwd();

console.log("Preparing VS Code extension (build @euix/doctor + bundle extension)...");

execSync("npm run doctor:build", { cwd: root, stdio: "inherit" });
execSync("npm run build -w euix-doctor", { cwd: root, stdio: "inherit" });

console.log("VS Code extension bundle ready.");
