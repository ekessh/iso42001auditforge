# SPDX-License-Identifier: BUSL-1.1
"""Wave-5 conformance-evidence check registration entrypoint.

Importing this module triggers `register()` for every Wave-5 conformance
check (P-LLM, P-DATA, P-RISK, P-GOV, P-AGENT, P-CHAIN). The Wave-4
checks (AC-* and P-MCP-*) self-register via `checks/__init__.py`.

Two import paths exist for symmetry:
  * `services.audit_evidence_runner.registry` — Wave-5 entrypoint.
  * `services.audit_evidence_runner.checks.__init__` — Wave-4 entrypoint
    that also pulls in this module so the FastAPI app boots with the
    full catalogue.

Catalogue counts at import time:
  AC-01..07      = 7
  P-MCP-01..08   = 8
  P-LLM-01..10   = 10
  P-DATA-01..08  = 8
  P-RISK-01..06  = 6
  P-GOV-01..06   = 6
  P-AGENT-01..05 = 5
  P-CHAIN-01..05 = 5
  Total          = 55
"""

from __future__ import annotations

from .checks import (  # noqa: F401 — register-on-import side effects
    p_agent_01_authorization_scope_bounded,
    p_agent_02_tool_manifest_frozen,
    p_agent_03_human_in_loop_triggers,
    p_agent_04_reversibility_guarantees,
    p_agent_05_failure_mode_logging,
    p_chain_01_step_boundary_logging,
    p_chain_02_authorization_at_each_step,
    p_chain_03_idempotency_keys_honored,
    p_chain_04_chain_timeout_bounded,
    p_chain_05_inter_step_sanitization,
    p_data_01_training_data_provenance,
    p_data_02_data_subject_rights,
    p_data_03_data_quality_metrics_logged,
    p_data_04_pii_tagging_on_ingestion,
    p_data_05_retention_schedule_active,
    p_data_06_cross_border_transfer_documented,
    p_data_07_synthetic_data_disclosure,
    p_data_08_dataset_versioning,
    p_gov_01_aims_scope_statement,
    p_gov_02_roles_and_responsibilities,
    p_gov_03_resource_allocation_approved,
    p_gov_04_communication_records,
    p_gov_05_document_control,
    p_gov_06_continual_improvement_backlog,
    p_llm_01_system_prompt_frozen,
    p_llm_02_output_length_bounded,
    p_llm_03_refusal_on_out_of_scope,
    p_llm_04_determinism_at_zero_temp,
    p_llm_05_citation_present,
    p_llm_06_no_training_data_leakage,
    p_llm_07_provider_switching_stability,
    p_llm_08_cost_cap_per_request,
    p_llm_09_inference_latency_bounded,
    p_llm_10_model_version_pinned,
    p_risk_01_risk_register_reviewed,
    p_risk_02_high_risk_treatment_plan_closed,
    p_risk_03_mitigation_effectiveness_test,
    p_risk_04_residual_risk_acknowledged,
    p_risk_05_change_triggered_reassessment,
    p_risk_06_risk_appetite_defined,
)
