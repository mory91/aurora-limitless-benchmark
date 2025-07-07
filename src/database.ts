import { type Knex } from "knex";
import knex from "knex";

import { type BenchmarkConfig } from "./types";

export const createAuroraLimitlessConnection = (
  config: BenchmarkConfig
): Knex => {
  const connectionString = `postgresql://${config.username}${
    config.password ? `:${config.password}` : ""
  }@${config.host}:${config.port}/${config.database}`;

  return knex({
    client: "pg",
    connection: {
      connectionString,
      ssl: config.ssl
        ? {
            rejectUnauthorized: false
          }
        : undefined
    },
    debug: false,
    pool: {
      min: Math.min(5, config.connectionsPerWorker),
      max: Math.max(20, config.connectionsPerWorker * 2),
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 3000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000
    }
  });
};

// Generic table access function
export const getTable = (db: Knex, tableName: string) => db(tableName);

export const truncateTable = async (
  db: Knex,
  tableName = "benchmark_data"
): Promise<void> => {
  await db(tableName).truncate();
};
