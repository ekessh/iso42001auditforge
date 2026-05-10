// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { ConflictError } from '../../common/errors.js';
import { queueToken } from '../../queue/queue.module.js';
import type { CreateReportDto, ReportDto, SignReportDto, UpdateReportDto } from './dto.js';
import type { ReportsRepository } from './reports.repository.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly repo: ReportsRepository,
    @Inject(queueToken('report-render')) private readonly renderQueue: Queue,
  ) {}

  create(firmId: string, dto: CreateReportDto): Promise<ReportDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<ReportDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { engagementId?: string; cursor?: string; limit: number }) { return this.repo.list(firmId, opts); }

  async update(firmId: string, id: string, dto: UpdateReportDto): Promise<ReportDto> {
    const cur = await this.repo.findById(firmId, id);
    if (cur.status === 'issued' || cur.status === 'archived') throw new ConflictError('Report is immutable');
    return this.repo.patch(firmId, id, dto);
  }

  async render(firmId: string, id: string): Promise<{ jobId: string }> {
    const r = await this.repo.findById(firmId, id);
    const job = await this.renderQueue.add('render', { reportId: r.id, firmId, engagementId: r.engagementId, version: r.version });
    return { jobId: String(job.id) };
  }

  async sign(firmId: string, id: string, auditorId: string, dto: SignReportDto): Promise<ReportDto> {
    const cur = await this.repo.findById(firmId, id);
    if (cur.status === 'issued') throw new ConflictError('Report already issued');
    const sigRef = createHash('sha256').update(`${id}:${dto.attestation}:${cur.version}`).digest('hex');
    return this.repo.sign(firmId, id, auditorId, sigRef);
  }
}
