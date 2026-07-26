import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";

/**
 * Loads env the way Next does for local development: .env.local wins, then
 * .env. Scripts run outside the Next runtime, so they need this explicitly.
 */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) dotenv.config({ path, override: false });
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `\nMissing ${name}.\nAdd it to .env.local (see .env.example) and run this again.\n`,
    );
    process.exit(1);
  }
  return value;
}
