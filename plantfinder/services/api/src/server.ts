import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createRuntime } from "./runtime.js";

const config = loadConfig();
const runtime = createRuntime(config);
const app = await buildApp({ config, ...runtime, logger: true });
await app.listen({ port: config.port, host: config.host });
app.log.info(
  { dataMode: config.dataMode, sourcePolicy: config.sourcePolicy, sources: runtime.search.adapters.map((a) => a.source.id), identify: !!runtime.identify },
  `PlantFinder API on http://${config.host}:${config.port}`
);
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => void app.close().then(() => process.exit(0)));
