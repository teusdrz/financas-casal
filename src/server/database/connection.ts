import fs from "fs";
import path from "path";
import initSqlJs, { Database, SqlValue } from "sql.js";
import { env } from "../config/env";
import { applySchema } from "./schema";

export type Row = Record<string, SqlValue>;
export type Params = SqlValue[];

/**
 * Banco local SQLite executado em WebAssembly (sql.js).
 * Nao depende de compilacao nativa: roda igual no Windows, macOS, Linux e no Render.
 * Cada escrita e gravada em disco de forma atomica (arquivo temporario + rename).
 */
export class LocalDatabase {
  private inTransaction = false;

  private constructor(private readonly db: Database, private readonly filePath: string) {}

  static async open(filePath: string): Promise<LocalDatabase> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => path.join(path.dirname(require.resolve("sql.js")), file),
    });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const db = fs.existsSync(filePath)
      ? new SQL.Database(fs.readFileSync(filePath))
      : new SQL.Database();
    db.exec("PRAGMA foreign_keys = ON;");
    const instance = new LocalDatabase(db, filePath);
    applySchema(instance);
    instance.persist();
    return instance;
  }

  all<T>(sql: string, params: Params = [], map: (row: Row) => T): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const out: T[] = [];
      while (stmt.step()) {
        out.push(map(stmt.getAsObject() as Row));
      }
      return out;
    } finally {
      stmt.free();
    }
  }

  get<T>(sql: string, params: Params, map: (row: Row) => T): T | null {
    const rows = this.all(sql, params, map);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Executa um comando de escrita e retorna o id inserido e linhas afetadas.
   * Fora de transacao, persiste imediatamente em disco.
   */
  run(sql: string, params: Params = []): { lastId: number; changes: number } {
    this.db.run(sql, params);
    const changes = this.db.getRowsModified();
    const idRow = this.db.exec("SELECT last_insert_rowid() AS id");
    const lastId = idRow.length > 0 ? Number(idRow[0].values[0][0]) : 0;
    if (!this.inTransaction) {
      this.persist();
    }
    return { lastId, changes };
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** Executa varias escritas de forma atomica e persiste uma unica vez. */
  transaction<T>(work: () => T): T {
    if (this.inTransaction) {
      return work();
    }
    this.db.exec("BEGIN TRANSACTION;");
    this.inTransaction = true;
    try {
      const result = work();
      this.db.exec("COMMIT;");
      this.inTransaction = false;
      this.persist();
      return result;
    } catch (error) {
      this.inTransaction = false;
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  /** Grava o banco em disco. Chamado apos cada operacao de escrita. */
  persist(): void {
    const data = this.db.export();
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(data));
    fs.renameSync(tmp, this.filePath);
    // export() reabre o banco internamente; reaplica o pragma de integridade.
    this.db.exec("PRAGMA foreign_keys = ON;");
  }
}

let instance: LocalDatabase | null = null;

export async function connectDatabase(): Promise<LocalDatabase> {
  if (!instance) {
    instance = await LocalDatabase.open(env.dbPath);
  }
  return instance;
}

export function getDatabase(): LocalDatabase {
  if (!instance) {
    throw new Error("Banco de dados ainda nao inicializado.");
  }
  return instance;
}
