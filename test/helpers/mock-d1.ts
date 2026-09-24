// @ts-nocheck
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

class MockD1PreparedStatement implements D1PreparedStatement {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: unknown[] = []
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new MockD1PreparedStatement(this.db, this.sql, values);
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...(this.params as (string | number | bigint | boolean | Uint8Array | null)[])) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    if (colName) {
      return (row[colName] as T) ?? null;
    }
    return row as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...(this.params as (string | number | bigint | boolean | Uint8Array | null)[]));
    return {
      success: true,
      results: [],
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
        changed_db: Number(info.changes) > 0,
        changes: Number(info.changes),
      },
    };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...(this.params as (string | number | bigint | boolean | Uint8Array | null)[])) as T[];
    return {
      success: true,
      results: rows,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: rows.length,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...(this.params as (string | number | bigint | boolean | Uint8Array | null)[]));
    return rows.map((r) => Object.values(r as Record<string, unknown>)) as unknown as T[];
  }
}

export class MockD1Database implements D1Database {
  private db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  prepare(query: string): D1PreparedStatement {
    return new MockD1PreparedStatement(this.db, query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const stmt of statements) {
      results.push(await stmt.run<T>());
    }
    return results;
  }

  async exec(query: string): Promise<D1ExecResult> {
    this.db.exec(query);
    return {
      count: 1,
      duration: 0,
    };
  }

  withSession(): D1DatabaseSession {
    throw new Error('withSession not implemented in MockD1Database');
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error('dump not implemented in MockD1Database');
  }

  applyMigration(sqlOrPath: string) {
    let sql = sqlOrPath;
    if (fs.existsSync(sqlOrPath)) {
      sql = fs.readFileSync(sqlOrPath, 'utf8');
    }
    this.db.exec(sql);
  }
}

export function createTestDatabase(): MockD1Database {
  const db = new MockD1Database(':memory:');
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    for (const file of files) {
      db.applyMigration(path.join(migrationsDir, file));
    }
  }
  return db;
}
