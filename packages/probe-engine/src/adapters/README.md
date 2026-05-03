<!-- SPDX-License-Identifier: BUSL-1.1 -->
# External Probe-Library Adapters

Per AuditForge ISO 42001 v3 design Section 15.16 #4, the probe engine wraps
mature upstream red-team / harm-evaluation libraries instead of
re-implementing every probe. This directory contains the adapters that
translate upstream output into AuditForge's `ProbeRunResult` format and stamp
each probe with the upstream license + version metadata required for
ISO/IEC 42001 evidence attribution.

## Wrapped libraries

| Library    | Vendor    | License    | Adapter file       |
|------------|-----------|------------|--------------------|
| garak      | NVIDIA    | Apache-2.0 | `garak.ts`         |
| PyRIT      | Microsoft | MIT        | `pyrit.ts`         |
| HarmBench  | CAIS      | MIT        | `harmbench.ts`     |

Each adapter implements the `ExternalProbeAdapter` interface defined in
`index.ts`:

```ts
interface ExternalProbeAdapter {
  readonly name: 'garak' | 'pyrit' | 'harmbench';
  listProbes(): Promise<readonly ExternalProbeDescriptor[]>;
  translateToAuditForge(d: ExternalProbeDescriptor): ProbeDefinition;
  run(probeId, params, sandbox, policy): Promise<ProbeExecutionResult>;
  verifyEnvironment(): Promise<{ ok: boolean; reasons: string[] }>;
}
```

## Wrapper pattern

Adapters are intentionally thin and follow exactly this shape:

1. **Translation** — upstream descriptor -> `ProbeDefinition`. Per-library
   mapping tables (`GARAK_MAPPING_RULES`, `PYRIT_MAPPING_RULES`,
   `HARMBENCH_MAPPING_RULES`) translate upstream categories to AuditForge
   ISO 42001 clauses, Annex A controls, and OWASP LLM Top 10 references.
2. **Invocation** — adapter calls the upstream tool through an injected
   `ProcessSpawner`. Adapters never spawn Python directly; the worker
   provides a real `node:child_process.spawn`-backed implementation, tests
   provide a mock that returns canned `SpawnResult`s. This makes every
   adapter unit-testable without ever executing Python.
3. **Normalisation** — upstream JSON -> `ProbeExecutionResult` shaped to
   feed `ProbeRunResult`. We stay close to upstream output structure so a
   reviewer can diff our normalised result against the upstream report file.

## Sandbox + cost / timeout enforcement

Adapters do not implement their own timeouts. The runner builds a
`SandboxPolicy` from the probe budget and the engagement's pre-approved
egress allowlist; the adapter passes `policy.wallClockMaxMs` straight into
`SpawnOptions.timeoutMs`. The sandbox in `apps/worker` enforces wall clock,
CPU, memory, and egress caps (Linux namespaces + seccomp + cgroups). The
adapter itself stays inside the sandbox boundary.

Cost enforcement is delegated to `BudgetController` in the runner. External
probes use `defaultExternalBudget()` — higher wall clock and memory than
in-tree probes because Python interpreters are slow to spin up.

## Verdict mapping

Upstream verdict tags project to `ProbeVerdict` via `projectVerdict()`:

| Upstream tag        | AuditForge verdict |
|---------------------|--------------------|
| `attack-succeeded`  | `fail`             |
| `harmful-output`    | `fail`             |
| `attack-blocked`    | `pass`             |
| `safe-output`       | `pass`             |
| `inconclusive`      | `inconclusive`     |
| `errored`           | `error` -> downgraded to `inconclusive` in `toProbeRunResult` |

HarmBench is special: it evaluates BOTH attack and defense sides, so
`ExternalProbeResult.coEvaluation` carries each independently. The runner
records the attacker-side verdict as a derived-metric evidence artifact.

### garak category mapping

| Upstream family     | AuditForge category | Annex A   | External                 |
|---------------------|---------------------|-----------|--------------------------|
| `dan` / `jailbreak` | injection           | A.6.2.7   | OWASP LLM01              |
| `promptinject`      | injection           | A.6.2.7   | OWASP LLM01              |
| `leakreplay`        | leakage             | A.7.4     | OWASP LLM02              |
| `lmrc`              | toxicity            | A.6.2.6   | —                        |
| `misleading`        | hallucination       | A.5.4     | —                        |

### PyRIT category mapping

| Upstream family            | AuditForge category | Annex A          |
|----------------------------|---------------------|------------------|
| `harmful_output` / `harm`  | toxicity            | A.6.2.6          |
| `agentic_attack`           | injection           | A.6.2.7, A.9     |
| `end_to_end_attack`        | injection           | A.6.2.7, A.9     |
| `red_team`                 | injection           | A.6.2.7          |
| `sensitive_information`    | leakage             | A.7.4 (LLM02)    |

### HarmBench category mapping

| Upstream category               | AuditForge category | Annex A          |
|---------------------------------|---------------------|------------------|
| `bias` / `discrimination`       | bias                | A.6.2.6, A.5.4   |
| `misinformation` / `hallucination` | hallucination    | A.5.4            |
| `harassment` / `hate` / `toxicity` | toxicity         | A.6.2.6          |
| `illegal` / `dangerous`         | toxicity            | A.6.2.6          |
| `privacy` / `pii`               | privacy             | A.7.4 (LLM02)    |
| `leakage`                       | leakage             | A.7.4 (LLM02)    |
| `jailbreak` / `prompt_injection` | injection          | A.6.2.7 (LLM01)  |
| `capability`                    | capability          | A.6.2.6          |

## License attribution

Each translated `ProbeDefinition` stores upstream provenance on every
execution via `derivedMetrics`:

```ts
{
  upstreamLibrary: 'garak' | 'pyrit' | 'harmbench',
  upstreamLicense: 'Apache-2.0' | 'MIT',
  upstreamVersion: '<version pin>',
  upstreamId: '<verbatim upstream probe id>',
  verdictTag: '<UpstreamVerdictTag>'
}
```

The audit ledger surfaces these so lead auditors can demonstrate proper
upstream attribution. The probe registry surfaces the same values via
`UpstreamProvenance` on every descriptor.

## Opting in to external probe libraries

External probe libraries are NOT enabled by default. AuditForge users opt in
per engagement via the engagement settings panel:

1. Engagement owner selects which external libraries to enable (garak /
   PyRIT / HarmBench).
2. The worker runs `verifyEnvironment()` for each enabled library and
   reports the result on the engagement dashboard. If the upstream tool is
   not installed, the engagement displays a remediation banner with the
   upstream installation URL.
3. Once verified, `listProbes()` discovers the available upstream probes
   and registers each as a translated `ProbeDefinition` in the engagement's
   probe registry.
4. The auditor then schedules external probes the same way they schedule
   in-tree probes; the runner routes through the adapter `run()` method
   instead of `ProbeDefinition.run`.

The opt-in mechanism keeps the default install footprint small (no Python
runtime required) and gives the engagement owner explicit control over the
provenance of each probe.

## Adapter testing

Adapters MUST be unit-testable without spawning Python. Tests in
`tests/adapters/` inject a mock `ProcessSpawner` that returns canned
`SpawnResult`s. The tests cover, for each adapter:

- `listProbes` returns translated descriptors with provenance attached
- result normalisation (upstream JSON -> AuditForge format)
- verdict mapping correctness
- sandbox policy enforcement (mocked spawner verifies passed `timeoutMs`)
- license metadata attached to translated definitions
- failure handling (Python missing, probe errored, output malformed)
- `verifyEnvironment` detects missing dependencies

If you add a new upstream library, follow the same pattern: add a mapping
table, add a Zod schema for the upstream output, implement the adapter,
write tests that drive every code path through a mock spawner.
