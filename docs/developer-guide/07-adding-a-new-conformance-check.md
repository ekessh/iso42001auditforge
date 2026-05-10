<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
cross-refs:
  - services/probe-runner-py/
  - packages/probe-engine/
  - docs/security/probe-catalogue.md
-->

# Adding a New Conformance Check

> How to add a new probe that auditors can run against an AIMS.

---

## Architecture

A conformance check (probe) consists of three layers:

1. **Python probe implementation** in `services/probe-runner-py/` —
   the actual test logic that interacts with the AI system.
2. **TypeScript probe definition** in `packages/probe-engine/` —
   the metadata record that the API serves and the UI displays.
3. **Catalogue entry** in `packages/catalogues/` — maps the probe ID
   to ISO 42001 Annex A controls and other frameworks.

---

## Step 1: Python Probe Implementation

Create `services/probe-runner-py/probes/my_probe.py`:

```python
# SPDX-License-Identifier: BUSL-1.1
from probe_runner.base import BaseProbe, ProbeResult, ProbeStatus
from probe_runner.schema import ProbeConfig

class MyProbe(BaseProbe):
    """
    MY-001: Description of what this probe checks.
    Clause mapping: ISO 42001 Annex A A.6.1.2
    """
    probe_id = "MY-001"
    version = "1.0.0"

    async def execute(self, config: ProbeConfig) -> ProbeResult:
        target_url = config.target_endpoint

        # Run the actual check against the AI system
        response = await self.http_client.post(
            target_url,
            json={"prompt": config.parameters.get("test_prompt")}
        )

        if self._meets_criteria(response):
            return ProbeResult(
                status=ProbeStatus.PASS,
                evidence={"response": response.text},
                confidence=0.95,
            )
        return ProbeResult(
            status=ProbeStatus.FAIL,
            evidence={"response": response.text, "reason": "criteria not met"},
            confidence=0.95,
        )

    def _meets_criteria(self, response) -> bool:
        # Implement the actual pass/fail logic here
        return "expected_marker" in response.text
```

Register the probe in `services/probe-runner-py/probes/__init__.py`.

---

## Step 2: TypeScript Probe Metadata

Add the probe metadata to `packages/probe-engine/src/catalogue/my-probe.ts`:

```typescript
// SPDX-License-Identifier: BUSL-1.1
import type { ProbeCatalogueEntry } from '../types';

export const myProbe: ProbeCatalogueEntry = {
  id: 'MY-001',
  version: '1.0.0',
  category: 'governance',  // or: llm, mcp, data, risk, agent, chain, annex-a
  name: 'My Conformance Check',
  description: 'Checks that the AIMS satisfies X.',
  clauseMappings: [
    { standard: 'ISO 42001', clause: 'A.6.1.2', rationale: '...' },
  ],
  parameters: [
    {
      name: 'test_prompt',
      type: 'string',
      required: true,
      description: 'The prompt to send to the AI system under test.',
    },
  ],
  estimatedDurationSeconds: 30,
  requiresCloudLLM: false,
};
```

Export it from `packages/probe-engine/src/catalogue/index.ts`.

---

## Step 3: Catalogue Entry

Add the probe to the catalogue seed data in
`packages/catalogues/src/probes/`. This populates the probe catalogue
in the database and makes the probe selectable in the UI.

```typescript
// packages/catalogues/src/probes/my-probe-seed.ts
// SPDX-License-Identifier: BUSL-1.1
export const myProbeSeed = {
  id: 'MY-001',
  category: 'governance',
  name: 'My Conformance Check',
  iso42001Clauses: ['A.6.1.2'],
  nistAiRmfFunctions: ['GOVERN'],
};
```

Run `pnpm db:seed` to load the updated catalogue.

---

## Step 4: Tests

Add a probe validity test in `tests/probe-validity/`:

```typescript
// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { runProbeAgainstMock } from '../helpers/mock-aim-runner';

describe('MY-001', () => {
  it('passes when the AI system meets the criteria', async () => {
    const result = await runProbeAgainstMock('MY-001', {
      mockBehavior: 'compliant',
    });
    expect(result.status).toBe('pass');
  });

  it('fails when the AI system does not meet the criteria', async () => {
    const result = await runProbeAgainstMock('MY-001', {
      mockBehavior: 'non-compliant',
    });
    expect(result.status).toBe('fail');
    expect(result.evidence).toBeDefined();
  });
});
```

---

## Step 5: Documentation

Update [../security/probe-catalogue.md](../security/probe-catalogue.md)
with the new probe entry (that file is owned by agent K — coordinate
via a PR).

---

## Cross-References

- [../security/probe-catalogue.md](../security/probe-catalogue.md) —
  existing probe catalogue.
- [../auditor-guide/08-probes-and-conformance-checks.md](../auditor-guide/08-probes-and-conformance-checks.md)
  — auditor perspective.
