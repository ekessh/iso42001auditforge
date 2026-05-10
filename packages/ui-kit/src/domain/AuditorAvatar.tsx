// SPDX-License-Identifier: BUSL-1.1
import * as React from 'react';

import { cn } from '../lib/cn';
import { Avatar } from '../components/Avatar';
import { Tooltip } from '../components/Tooltip';

export type AuditorRole =
  | 'lead-auditor'
  | 'team-auditor'
  | 'technical-expert'
  | 'audit-manager'
  | 'peer-reviewer'
  | 'accreditation-auditor'
  | 'auditee'
  | 'firm-admin'
  | 'super-admin';

const roleLabel: Record<AuditorRole, string> = {
  'lead-auditor': 'Lead',
  'team-auditor': 'Team',
  'technical-expert': 'Tech',
  'audit-manager': 'Mgr',
  'peer-reviewer': 'Peer',
  'accreditation-auditor': 'AB',
  auditee: 'AE',
  'firm-admin': 'Firm',
  'super-admin': 'Sys',
};

const roleTone: Record<AuditorRole, string> = {
  'lead-auditor': 'bg-primary text-primary-foreground',
  'team-auditor': 'bg-info text-info-foreground',
  'technical-expert': 'bg-violet-600 text-white',
  'audit-manager': 'bg-amber-600 text-white',
  'peer-reviewer': 'bg-teal-700 text-white',
  'accreditation-auditor': 'bg-neutral-700 text-white',
  auditee: 'bg-muted text-muted-foreground',
  'firm-admin': 'bg-navy-700 text-white',
  'super-admin': 'bg-destructive text-destructive-foreground',
};

export interface AuditorAvatarProps {
  name: string;
  role: AuditorRole;
  src?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AuditorAvatar = ({ name, role, src, initials, size = 'md', className }: AuditorAvatarProps) => (
  <Tooltip label={`${name} — ${roleLabel[role]}`}>
    <span className={cn('relative inline-flex', className)}>
      <Avatar size={size} alt={name} {...(src !== undefined ? { src } : {})} {...(initials !== undefined ? { initials } : {})} />
      <span
        aria-hidden
        className={cn(
          'absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded px-1 text-[8px] font-bold leading-tight ring-2 ring-card',
          roleTone[role],
        )}
      >
        {roleLabel[role]}
      </span>
    </span>
  </Tooltip>
);
