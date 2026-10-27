import { connectDatabase } from "./connection";
import { runSeed } from "./seed";
import { env } from "../config/env";

/** Execucao manual: npm run seed */
connectDatabase()
  .then(() => {
    runSeed();
    console.log(`[seed] Banco pronto em ${env.dbPath}`);
  })
  .catch((error: unknown) => {
    console.error("[seed] Falha:", error);
    process.exitCode = 1;
  });
