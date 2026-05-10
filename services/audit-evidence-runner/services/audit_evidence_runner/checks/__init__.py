# SPDX-License-Identifier: BUSL-1.1
"""Built-in audit-evidence checks.

The package self-registers each check at import time via the `@register`
decorator from `.base`. New checks must be importable from this package's
`__init__` so the catalogue picks them up at startup.
"""

from . import (  # noqa: F401 — import for side-effects (registry population)
    ac_01_authorization_required,
    ac_02_rate_limit_present,
    ac_03_input_length_bounded,
    ac_04_output_schema_conformant,
    ac_05_pii_redaction_active,
    ac_06_provenance_headers,
    ac_07_audit_log_generated,
    p_mcp_01_tool_catalogue_validation,
    p_mcp_02_server_allowlist,
    p_mcp_03_audit_trail_completeness,
    p_mcp_04_authentication_mode,
    p_mcp_05_per_tool_rbac,
    p_mcp_06_resource_provenance_verification,
    p_mcp_07_cross_server_session_isolation,
    p_mcp_08_gateway_policy_enforcement,
)

# Wave-5: conformance evidence checks (P-LLM, P-DATA, P-RISK, P-GOV,
# P-AGENT, P-CHAIN). The registry module imports each check module for
# its register-on-import side effect.
from .. import registry as _wave5_registry  # noqa: F401, E402
