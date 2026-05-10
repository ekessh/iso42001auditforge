// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { LibraryRepository } from './library.repository.js';
import type { LibraryPageDto, LibraryQueryDto } from './dto.js';

@Injectable()
export class LibraryService {
  constructor(private readonly repo: LibraryRepository) {}

  async list(q: LibraryQueryDto): Promise<LibraryPageDto> {
    const r = await this.repo.list(q);
    return { items: r.items, nextCursor: r.nextCursor, prevCursor: null };
  }
}
