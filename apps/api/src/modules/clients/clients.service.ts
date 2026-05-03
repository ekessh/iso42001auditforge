// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateClientsDto, UpdateClientsDto, ClientsDto } from './dto.js';
import { ClientsRepository } from './clients.repository.js';

@Injectable()
export class ClientsService {
  constructor(private readonly repo: ClientsRepository) {}

  create(firmId: string, dto: CreateClientsDto): Promise<ClientsDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<ClientsDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: ClientsDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateClientsDto): Promise<ClientsDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
