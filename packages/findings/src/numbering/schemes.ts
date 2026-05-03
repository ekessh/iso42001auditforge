// SPDX-License-Identifier: BUSL-1.1
import type { NumberingScheme } from '../types/numbering.js';

/**
 * Default numbering schemes shipped with AuditForge core. CBs can override
 * by passing their own scheme list to `createNumberingService`.
 */
export function defaultNumberingSchemes(): readonly NumberingScheme[] {
  return [
    {
      key: 'NC',
      name: 'Default Non-Conformity numbering',
      appliesTo: ['major_nc', 'minor_nc'],
      template: 'NC-{year}-{seq}',
      pad: 4,
      reset: 'year',
    },
    {
      key: 'OFI',
      name: 'Default Opportunity For Improvement numbering',
      appliesTo: ['ofi'],
      template: 'OFI-{engagement}-{seq}',
      pad: 3,
      reset: 'engagement',
    },
    {
      key: 'CONF',
      name: 'Default Conformity statement numbering',
      appliesTo: ['conformity'],
      template: 'CONF-{year}-{seq}',
      pad: 4,
      reset: 'year',
    },
  ];
}
