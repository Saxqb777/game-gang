import { neon } from '@neondatabase/serverless';
import type { Row, SqlRunner } from './sql';

/** Neon over HTTPS: no connection pool to manage, which suits short-lived serverless functions. */
export function createNeonRunner(databaseUrl: string): SqlRunner {
  const sql = neon(databaseUrl);
  return {
    async batch(queries) {
      const [only] = queries;
      if (queries.length === 1 && only) {
        return [(await sql.query(only.text, only.params)) as Row[]];
      }
      const results = await sql.transaction(queries.map((query) => sql.query(query.text, query.params)));
      return results as Row[][];
    },
  };
}
