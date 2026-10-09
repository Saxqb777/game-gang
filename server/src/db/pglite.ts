import { PGlite } from '@electric-sql/pglite';
import type { Row, SqlRunner } from './sql';

/**
 * In-memory Postgres (WASM) for local dev and tests when DATABASE_URL is not set.
 * Runs the exact same SQL as production. Data is lost when the process exits.
 */
export async function createPgliteRunner(): Promise<SqlRunner> {
  const db = await PGlite.create();
  return {
    batch(queries) {
      return db.transaction(async (tx) => {
        const results: Row[][] = [];
        for (const query of queries) {
          const result = await tx.query<Row>(query.text, query.params);
          results.push(result.rows);
        }
        return results;
      });
    },
  };
}
