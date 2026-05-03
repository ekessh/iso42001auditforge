// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const CursorPageQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.string().regex(/^[a-zA-Z_]+(:asc|:desc)?$/).optional(),
  filter: z.string().max(2048).optional(),
});
export type CursorPageQuery = z.infer<typeof CursorPageQuerySchema>;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  totalEstimate?: number;
}

export function makePage<T>(items: T[], nextCursor: string | null, prevCursor: string | null = null): CursorPage<T> {
  return { items, nextCursor, prevCursor };
}
