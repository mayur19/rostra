import pg from 'pg';

export type Db = pg.Pool;
export type Queryable = pg.Pool | pg.PoolClient;

// Return bigint/numeric columns as JS numbers where they are known to be safe (counts).
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export function createPool(connectionString: string): Db {
  return new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

/** Runs `work` in a transaction, rolling back on any error. */
export async function withTransaction<T>(
  db: Db,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
