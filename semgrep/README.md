# Semgrep Custom Rules

<!-- SPDX-License-Identifier: BUSL-1.1 -->

Project-specific Semgrep rules that encode CLAUDE.md hard rules so CI
catches violations before merge.

## Install

Semgrep is a Python tool. GitHub Actions has it natively
(`returntocorp/semgrep` container). For local runs:

```sh
# pip
python -m pip install semgrep

# brew (mac)
brew install semgrep

# pipx (recommended)
pipx install semgrep
```

## Run

```sh
semgrep --config semgrep/ --severity ERROR --severity WARNING .
```

To target one rule:

```sh
semgrep --config semgrep/free-form-llm-output.yml .
```

## Rules in this directory

- `free-form-llm-output.yml` — LLM provider calls without a zod schema
  (CLAUDE.md hard rule "schema-constrained extraction; free-form output
  is a bug").
- `auditee-cf-leak.yml` — routes that surface candidate-finding data on
  an auditee-role-accessible path (CLAUDE.md "candidate findings never
  visible to auditee").
- `clause-id-validity.yml` — re-ranker outputs that include strings not
  matching the ISO 42001 clause-id grammar.
- `missing-spdx.yml` — new TS/JS/Python files without SPDX header.

## CI Behaviour

`security.yml` runs Semgrep with `--config auto --config semgrep/`. Wave-3
adds the custom rules but classifies findings as **WARNING** (not yet
ERROR) so existing violations surface as a backlog rather than blocking
merge until the codebase is clean. Promote to ERROR once the backlog is
zero.
