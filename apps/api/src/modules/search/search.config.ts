// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const SearchConfigSchema = z.object({
  MEILISEARCH_HOST: z.string().url().default('http://localhost:7700'),
  MEILISEARCH_API_KEY: z.string().default(''),
  MEILISEARCH_INDEX_PREFIX: z.string().default('auditforge'),
  OLLAMA_HOST: z.string().url().default('http://localhost:11434'),
  OLLAMA_EMBED_MODEL: z.string().default('nomic-embed-text'),
  SEARCH_EMBED_DIMENSION: z.coerce.number().int().positive().default(1536),
});
export type SearchConfig = z.infer<typeof SearchConfigSchema>;

export function loadSearchConfig(env: NodeJS.ProcessEnv = process.env): SearchConfig {
  return SearchConfigSchema.parse({
    MEILISEARCH_HOST: env['MEILISEARCH_HOST'],
    MEILISEARCH_API_KEY: env['MEILISEARCH_API_KEY'],
    MEILISEARCH_INDEX_PREFIX: env['MEILISEARCH_INDEX_PREFIX'],
    OLLAMA_HOST: env['OLLAMA_HOST'],
    OLLAMA_EMBED_MODEL: env['OLLAMA_EMBED_MODEL'],
    SEARCH_EMBED_DIMENSION: env['SEARCH_EMBED_DIMENSION'],
  });
}
