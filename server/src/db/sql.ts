/** Minimal SQL runner so the same store code runs on Neon (production) and PGlite (local dev, tests). */
export interface SqlQuery {
  text: string;
  params: unknown[];
}

export type Row = Record<string, unknown>;

export interface SqlRunner {
  /** Runs the queries in order inside one transaction (one HTTP round trip on Neon). */
  batch(queries: SqlQuery[]): Promise<Row[][]>;
}

export function q(text: string, ...params: unknown[]): SqlQuery {
  return { text, params };
}

/** Postgres "relation does not exist", used to lazily create the schema on first use. */
export function isMissingTableError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '42P01';
}
