#!/usr/bin/env node

import { runDoctorCli } from "../dist/cli/main.js";

const code = await runDoctorCli(process.argv.slice(2), process.cwd());
process.exit(code);
