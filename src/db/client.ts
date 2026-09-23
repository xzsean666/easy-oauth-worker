export async function queryFirst<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...params);
  return stmt.first<T>();
}

export async function queryAll<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  return result.results || [];
}

export async function execute(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<D1Result> {
  const stmt = db.prepare(sql).bind(...params);
  return stmt.run();
}

export async function executeBatch(
  db: D1Database,
  statements: { sql: string; params?: unknown[] }[]
): Promise<D1Result[]> {
  const prepared = statements.map((s) => {
    const stmt = db.prepare(s.sql);
    return s.params && s.params.length > 0 ? stmt.bind(...s.params) : stmt;
  });
  return db.batch(prepared);
}

export async function execSql(
  db: D1Database,
  sql: string
): Promise<D1ExecResult> {
  return db.exec(sql);
}
