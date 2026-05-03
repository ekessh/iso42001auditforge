// SPDX-License-Identifier: BUSL-1.1
import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';

export const DRIZZLE = Symbol.for('AuditForge.Drizzle');
export const PG_CLIENT = Symbol.for('AuditForge.Postgres');

export type Db = PostgresJsDatabase;

@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) =>
        postgres(cfg.DATABASE_URL, {
          max: cfg.DATABASE_POOL_MAX,
          ssl: cfg.DATABASE_SSL ? 'require' : false,
          prepare: false,
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      useFactory: (sql: postgres.Sql): Db => drizzle(sql),
    },
  ],
  exports: [DRIZZLE, PG_CLIENT],
})
export class DbModule implements OnModuleDestroy {
  constructor(@Inject(PG_CLIENT) private readonly sql: postgres.Sql) {}
  async onModuleDestroy(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
