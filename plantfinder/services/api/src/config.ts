import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Config {
  port: number;
  host: string;
  dataMode: "live" | "fixture";
  sourcePolicy: "personal" | "public";
  allowedOrigins: string[];
  plantnetKey: string | null;
  dataDir: string;
  fixturesDir: string;
  webDist: string | null;
  userAgent: string;
  version: string;
}

const here = dirname(fileURLToPath(import.meta.url));
// src/ (tsx) and dist/ (bundled) both sit directly under services/api
const apiRoot = resolve(here, "..");

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, name: string): T {
  if (value === undefined || value === "") return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`${name} must be one of ${allowed.join(", ")} (got "${value}")`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("PORT must be a valid port");
  return {
    port,
    host: env.HOST ?? "127.0.0.1",
    dataMode: oneOf(env.PF_DATA_MODE, ["live", "fixture"] as const, "live", "PF_DATA_MODE"),
    sourcePolicy: oneOf(env.PF_SOURCE_POLICY, ["personal", "public"] as const, "personal", "PF_SOURCE_POLICY"),
    allowedOrigins: (env.PF_ALLOWED_ORIGINS ?? "chrome-extension://*")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    plantnetKey: env.PLANTNET_API_KEY?.trim() || null,
    dataDir: env.PF_DATA_DIR ?? join(apiRoot, ".data"),
    fixturesDir: env.PF_FIXTURES_DIR ?? join(apiRoot, "fixtures"),
    webDist: env.PF_WEB_DIST ?? join(apiRoot, "../../apps/web/dist"),
    userAgent: env.PF_USER_AGENT ?? "PlantFinderBot/0.1 (plant price-comparison pilot; low-rate, robots.txt-compliant)",
    version: "0.1.0"
  };
}
