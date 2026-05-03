// SPDX-License-Identifier: BUSL-1.1
/**
 * MultiClauseLinker — validates the clause + Annex A control links on a
 * finding against an injected catalogue. The catalogue is a thin interface
 * so this package doesn't pull in the real `@auditforge/catalogues` data
 * loader at runtime (tests use a stub catalogue with a fixed clause set).
 */
import { ValidationError } from '@auditforge/shared';
import type { ClauseLink, ControlLink } from '../types/finding.js';

export interface ClauseCatalogueLookup {
  /** Returns true iff the clause exists in the given framework. */
  hasClause(framework: string, clauseId: string): boolean;
  /** Returns true iff the Annex A control exists. */
  hasControl(controlId: string): boolean;
}

export interface MultiClauseLinker {
  validate(
    clauseLinks: readonly ClauseLink[],
    controlLinks: readonly ControlLink[],
  ): void;
}

export interface LinkerOptions {
  /**
   * Whether at least one clause link is required (defaults to `true`,
   * matching ISO 17021-1 9.4.8 which requires a clause-anchored finding).
   * Conformity statements with no specific clause anchor can pass `false`.
   */
  readonly requireAtLeastOneClause?: boolean;
}

export function createMultiClauseLinker(
  catalogue: ClauseCatalogueLookup,
  options: LinkerOptions = {},
): MultiClauseLinker {
  const requireOne = options.requireAtLeastOneClause ?? true;
  return {
    validate(clauseLinks, controlLinks) {
      if (requireOne && clauseLinks.length === 0 && controlLinks.length === 0) {
        throw new ValidationError(
          'Finding must link to at least one clause or Annex A control',
          {},
        );
      }

      // Detect duplicates within the same finding — a finding citing the
      // same clause twice is almost always a copy-paste mistake.
      const clauseKeys = new Set<string>();
      for (const c of clauseLinks) {
        const key = `${c.framework}::${c.clauseId}`;
        if (clauseKeys.has(key)) {
          throw new ValidationError(`Duplicate clause link: ${key}`, { key });
        }
        clauseKeys.add(key);
        if (!catalogue.hasClause(c.framework, c.clauseId)) {
          throw new ValidationError(
            `Unknown clause: framework=${c.framework} id=${c.clauseId}`,
            { framework: c.framework, clauseId: c.clauseId },
          );
        }
      }

      const controlKeys = new Set<string>();
      for (const ct of controlLinks) {
        if (controlKeys.has(ct.controlId)) {
          throw new ValidationError(`Duplicate control link: ${ct.controlId}`, {
            controlId: ct.controlId,
          });
        }
        controlKeys.add(ct.controlId);
        if (!catalogue.hasControl(ct.controlId)) {
          throw new ValidationError(`Unknown Annex A control: ${ct.controlId}`, {
            controlId: ct.controlId,
          });
        }
      }
    },
  };
}

/**
 * Convenience: a permissive catalogue (all lookups succeed). Useful for
 * tests that don't care about catalogue validation.
 */
export function permissiveCatalogue(): ClauseCatalogueLookup {
  return {
    hasClause: () => true,
    hasControl: () => true,
  };
}

/**
 * Convenience: build a catalogue from explicit allow lists.
 */
export interface FixedCatalogueOptions {
  readonly clauses: ReadonlyMap<string, ReadonlySet<string>>;
  readonly controls: ReadonlySet<string>;
}

export function fixedCatalogue(
  options: FixedCatalogueOptions,
): ClauseCatalogueLookup {
  return {
    hasClause(framework, clauseId) {
      return options.clauses.get(framework)?.has(clauseId) ?? false;
    },
    hasControl(controlId) {
      return options.controls.has(controlId);
    },
  };
}
