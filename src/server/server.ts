import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./database/connection";
import { runSeed } from "./database/seed";

async function bootstrap(): Promise<void> {
  await connectDatabase();
  runSeed();
  const app = createApp();
  app.listen(env.port, "0.0.0.0", () => {
    console.log(`[financas] Servidor em http://localhost:${env.port}`);
    console.log(`[financas] Banco SQLite: ${env.dbPath}`);
  });
}

bootstrap().catch((error: unknown) => {
  console.error("[financas] Falha ao iniciar:", error);
  process.exit(1);
});
