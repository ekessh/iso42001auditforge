// SPDX-License-Identifier: BUSL-1.1
import type { AiSystem } from '../types/ai-system.js';
import { isAgentKind } from '../types/kinds.js';
import type { AiSystemKind } from '../types/kinds.js';
import {
  type EuAiActTier,
  type NistAiRmfSubcategory,
  type RiskMatch,
} from '../types/risk.js';

interface ClassificationRule {
  readonly id: string;
  readonly tier: EuAiActTier;
  readonly priority: number;
  readonly when: (system: AiSystem, lower: string) => boolean;
  readonly rationale: string;
}

/**
 * EU AI Act classification rules — encoded as a priority-ordered table so
 * the result is reproducible and unit-testable. Higher priority wins.
 *
 * Rule corpus distilled from EU AI Act Articles 5 (prohibited), 6 + Annex
 * III (high-risk), 50 (transparency / limited-risk) and Articles 51–55
 * (GPAI). NOTE: the helper is advisory — final tiering remains the
 * auditor's call.
 */
const RULES: readonly ClassificationRule[] = [
  // ---- Article 5: prohibited ----
  {
    id: 'art5_social_scoring',
    tier: 'prohibited',
    priority: 100,
    when: (_s, l) => /social scoring|citizen scoring/.test(l),
    rationale: 'Article 5(1)(c) — social scoring of natural persons',
  },
  {
    id: 'art5_subliminal_manipulation',
    tier: 'prohibited',
    priority: 100,
    when: (_s, l) => /subliminal|manipulat(e|ive)\s+behaviou?r/.test(l),
    rationale: 'Article 5(1)(a) — subliminal techniques distorting behaviour',
  },
  {
    id: 'art5_realtime_biometric_publicspace',
    tier: 'prohibited',
    priority: 100,
    when: (_s, l) =>
      /(real[- ]?time)\s+(remote\s+)?biometric/.test(l) && /public\s+space|street|public area/.test(l),
    rationale: 'Article 5(1)(h) — real-time remote biometric ID in publicly accessible spaces',
  },
  {
    id: 'art5_emotion_workplace',
    tier: 'prohibited',
    priority: 100,
    when: (_s, l) =>
      /emotion\s+recognition/.test(l) && /(workplace|employer|education|school)/.test(l),
    rationale: 'Article 5(1)(f) — emotion recognition in workplace/education',
  },
  {
    id: 'art5_predictive_policing_individual',
    tier: 'prohibited',
    priority: 99,
    when: (_s, l) => /predict(ive)?\s+polic(e|ing)/.test(l) && /individual/.test(l),
    rationale: 'Article 5(1)(d) — individual predictive policing',
  },
  {
    id: 'art5_facial_scraping',
    tier: 'prohibited',
    priority: 99,
    when: (_s, l) =>
      /scrap(e|ing)/.test(l) && /(facial|face|cctv|internet)/.test(l) && /database|dataset/.test(l),
    rationale: 'Article 5(1)(e) — untargeted scraping for facial-recognition databases',
  },

  // ---- Annex III high-risk areas ----
  {
    id: 'annex3_biometric_id',
    tier: 'high_risk',
    priority: 80,
    when: (_s, l) => /biometric (identification|categori[sz]ation)/.test(l),
    rationale: 'Annex III(1) — biometric identification & categorisation',
  },
  {
    id: 'annex3_critical_infra',
    tier: 'high_risk',
    priority: 80,
    when: (_s, l) =>
      /(critical\s+infrastructure|electric grid|water supply|gas supply|traffic management)/.test(l),
    rationale: 'Annex III(2) — management/operation of critical infrastructure',
  },
  {
    id: 'annex3_education_assessment',
    tier: 'high_risk',
    priority: 80,
    when: (_s, l) =>
      /(education|exam|admission|grading|student assessment)/.test(l) && !/tutor|study aid/.test(l),
    rationale: 'Annex III(3) — education & vocational training (admission/assessment)',
  },
  {
    id: 'annex3_employment',
    tier: 'high_risk',
    priority: 80,
    when: (_s, l) =>
      /(recruit(ment)?|hir(e|ing)|cv (screening|filter)|resume screening|promotion|terminat(e|ion))/.test(l),
    rationale: 'Annex III(4) — employment & worker management',
  },
  {
    id: 'annex3_essential_services',
    tier: 'high_risk',
    priority: 80,
    when: (_s, l) =>
      /(creditworthiness|credit scoring|insurance pricing|public assistance|benefit eligibility|emergency dispatch)/.test(
        l,
      ),
    rationale: 'Annex III(5) — access to essential services & benefits',
  },
  {
    id: 'annex3_law_enforcement',
    tier: 'high_risk',
    priority: 80,
    when: (_s, l) =>
      /(law enforcement|polygraph|evidence reliability|crime risk assessment)/.test(l),
    rationale: 'Annex III(6) — law enforcement use cases',
  },
  {
    id: 'annex3_migration',
    tier: 'high_risk',
    priority: 80,
    when: (_s, l) => /(migration|asylum|border (control|management)|visa)/.test(l),
    rationale: 'Annex III(7) — migration, asylum & border control',
  },
  {
    id: 'annex3_justice_democracy',
    tier: 'high_risk',
    priority: 80,
    when: (_s, l) =>
      /(judicial|court ruling|election|democratic process|legal interpretation)/.test(l),
    rationale: 'Annex III(8) — administration of justice & democratic processes',
  },
  {
    id: 'medical_device',
    tier: 'high_risk',
    priority: 78,
    when: (_s, l) =>
      /(medical device|clinical decision|diagnos(is|tic)|therap(y|eutic))/.test(l) &&
      !/general (wellness|fitness)/.test(l),
    rationale: 'Article 6(1) + product-safety legislation (MDR/IVDR)',
  },

  // ---- General Purpose AI (GPAI) ----
  {
    id: 'gpai_systemic',
    tier: 'general_purpose',
    priority: 60,
    when: (s, _l) => {
      if (s.kind !== 'foundation_model' && s.kind !== 'generative_llm') return false;
      const intake = s.intake;
      if (intake.kind === 'foundation_model') {
        return (intake.training_compute_flops ?? 0) >= 1e25 || intake.systemic_risk_flag === true;
      }
      if (intake.kind === 'generative_llm') {
        return (intake.parameter_count ?? 0) >= 1e11;
      }
      return false;
    },
    rationale: 'Article 51 — GPAI with systemic risk threshold',
  },
  {
    id: 'gpai_default',
    tier: 'general_purpose',
    priority: 50,
    when: (s) => s.kind === 'foundation_model' || s.kind === 'generative_llm',
    rationale: 'Articles 51–55 — General-purpose AI obligations',
  },

  // ---- Article 50 transparency / limited risk ----
  {
    id: 'art50_chatbot',
    tier: 'limited_risk',
    priority: 40,
    when: (s, l) =>
      isAgentKind(s.kind) || /chatbot|assistant interacting|customer support/.test(l),
    rationale: 'Article 50(1) — disclosure that user is interacting with AI',
  },
  {
    id: 'art50_deepfake',
    tier: 'limited_risk',
    priority: 40,
    when: (_s, l) => /(deepfake|synthetic (media|audio|video|image)|generated (image|video|audio))/.test(l),
    rationale: 'Article 50(2)(4) — synthetic content disclosure',
  },

  // ---- Minimal risk (catch-all) ----
  {
    id: 'minimal_default',
    tier: 'minimal_risk',
    priority: 1,
    when: () => true,
    rationale: 'Default — no rule matched a higher tier',
  },
];

/** Number of EU AI Act classification rules, exported for sanity tests. */
export const EU_AI_ACT_RULE_COUNT = RULES.length;

/**
 * NIST AI RMF 1.0 — kind-driven subcategory recommendations. Curated map
 * surfaced to auditors as starting points; not exhaustive.
 */
const NIST_BY_KIND: Readonly<Record<AiSystemKind, readonly NistAiRmfSubcategory[]>> = {
  predictive_ml: [
    { function: 'MAP', category: 'MAP-2.3', rationale: 'characterise data sources and quality' },
    { function: 'MEASURE', category: 'MEASURE-2.11', rationale: 'fairness assessment' },
    { function: 'MANAGE', category: 'MANAGE-2.2', rationale: 'monitor for drift & degradation' },
  ],
  generative_llm: [
    { function: 'GOVERN', category: 'GOVERN-1.1', rationale: 'policy for generative content' },
    { function: 'MEASURE', category: 'MEASURE-2.6', rationale: 'evaluate harmful outputs' },
    { function: 'MEASURE', category: 'MEASURE-2.7', rationale: 'security against prompt injection' },
    { function: 'MANAGE', category: 'MANAGE-1.3', rationale: 'incident response for harmful generations' },
  ],
  foundation_model: [
    { function: 'GOVERN', category: 'GOVERN-1.6', rationale: 'organisational policy for foundation use' },
    { function: 'MAP', category: 'MAP-3.1', rationale: 'capability mapping' },
    { function: 'MEASURE', category: 'MEASURE-2.6', rationale: 'evaluate harmful outputs' },
  ],
  edge_model: [
    { function: 'MEASURE', category: 'MEASURE-2.5', rationale: 'evaluate robustness on target HW' },
    { function: 'MANAGE', category: 'MANAGE-2.4', rationale: 'OTA update governance' },
  ],
  multimodal: [
    { function: 'MAP', category: 'MAP-3.1', rationale: 'capability mapping across modalities' },
    { function: 'MEASURE', category: 'MEASURE-2.6', rationale: 'evaluate harmful outputs' },
  ],
  agent_assistant: [
    { function: 'GOVERN', category: 'GOVERN-1.5', rationale: 'human oversight design' },
    { function: 'MEASURE', category: 'MEASURE-2.7', rationale: 'prompt-injection resilience' },
  ],
  tool_using_agent: [
    { function: 'GOVERN', category: 'GOVERN-1.5', rationale: 'tool ACL governance' },
    { function: 'MAP', category: 'MAP-5.1', rationale: 'tool risk mapping' },
    { function: 'MEASURE', category: 'MEASURE-2.7', rationale: 'permission drift detection' },
  ],
  rag_agent: [
    { function: 'MAP', category: 'MAP-2.3', rationale: 'retrieval source provenance' },
    { function: 'MEASURE', category: 'MEASURE-2.7', rationale: 'indirect prompt injection' },
  ],
  browser_agent: [
    { function: 'GOVERN', category: 'GOVERN-1.5', rationale: 'allowlist governance' },
    { function: 'MEASURE', category: 'MEASURE-2.7', rationale: 'web-injection resilience' },
  ],
  code_agent: [
    { function: 'GOVERN', category: 'GOVERN-1.5', rationale: 'sandboxing policy' },
    { function: 'MANAGE', category: 'MANAGE-2.3', rationale: 'incident handling for code execution' },
  ],
  multi_agent_workflow: [
    { function: 'MAP', category: 'MAP-5.1', rationale: 'inter-agent risk topology' },
    { function: 'MANAGE', category: 'MANAGE-2.2', rationale: 'monitor coordination failures' },
  ],
  autonomous_loop: [
    { function: 'GOVERN', category: 'GOVERN-1.5', rationale: 'budget caps & termination' },
    { function: 'MANAGE', category: 'MANAGE-1.3', rationale: 'runaway response' },
  ],
  hitl_workflow: [
    { function: 'GOVERN', category: 'GOVERN-1.5', rationale: 'human-in-the-loop policy' },
    { function: 'MEASURE', category: 'MEASURE-3.3', rationale: 'gate respect verification' },
  ],
  long_horizon_agent: [
    { function: 'MANAGE', category: 'MANAGE-2.2', rationale: 'horizon monitoring' },
    { function: 'GOVERN', category: 'GOVERN-1.5', rationale: 'plan-review policy' },
  ],
  cross_system_agent: [
    { function: 'MAP', category: 'MAP-5.1', rationale: 'trust-boundary mapping' },
    { function: 'MANAGE', category: 'MANAGE-2.3', rationale: 'cross-system incident handling' },
  ],
  training_pipeline: [
    { function: 'MAP', category: 'MAP-2.3', rationale: 'data lineage' },
    { function: 'MEASURE', category: 'MEASURE-2.5', rationale: 'reproducibility checks' },
  ],
  inference_platform: [
    { function: 'MEASURE', category: 'MEASURE-3.1', rationale: 'production monitoring' },
    { function: 'MANAGE', category: 'MANAGE-2.4', rationale: 'rollback / kill-switch' },
  ],
  mcp_server: [
    { function: 'GOVERN', category: 'GOVERN-1.5', rationale: 'tool exposure governance' },
    { function: 'MEASURE', category: 'MEASURE-2.7', rationale: 'authorization checks' },
  ],
  vector_db: [
    { function: 'MAP', category: 'MAP-2.3', rationale: 'index data classification' },
    { function: 'MANAGE', category: 'MANAGE-2.3', rationale: 'incident response for leakage' },
  ],
  prompt_registry: [
    { function: 'GOVERN', category: 'GOVERN-1.6', rationale: 'change-management policy' },
  ],
  eval_harness: [
    { function: 'MEASURE', category: 'MEASURE-2.5', rationale: 'systematic evaluation' },
  ],
  guardrail_system: [
    { function: 'MANAGE', category: 'MANAGE-1.3', rationale: 'guardrail bypass response' },
    { function: 'MEASURE', category: 'MEASURE-2.7', rationale: 'guardrail efficacy' },
  ],
};

/**
 * Heuristic match-table for MIT AIR / AVID / MITRE ATLAS / OWASP LLM10
 * top-10 lookups. Confidence scores reflect how unambiguous the match is.
 */
interface KeywordMatch {
  framework: RiskMatch['framework'];
  category: string;
  pattern: RegExp;
  baseConfidence: number;
  rationale: string;
}

const KEYWORDS: readonly KeywordMatch[] = [
  // MIT AIR
  { framework: 'MIT_AIR', category: '1.1 Unfair discrimination', pattern: /(bias|discrimina|fair(ness)?|protected (attribute|class))/i, baseConfidence: 0.7, rationale: 'discrimination/bias mention' },
  { framework: 'MIT_AIR', category: '2.1 Privacy violation', pattern: /(pii|personal data|gdpr|privacy)/i, baseConfidence: 0.6, rationale: 'privacy concerns' },
  { framework: 'MIT_AIR', category: '2.2 Cybersecurity', pattern: /(jailbreak|prompt injection|adversarial)/i, baseConfidence: 0.7, rationale: 'security threat' },
  { framework: 'MIT_AIR', category: '3.1 Misinformation', pattern: /(misinform|disinform|hallucinat|deepfake)/i, baseConfidence: 0.7, rationale: 'misinformation risk' },
  { framework: 'MIT_AIR', category: '4.1 Malicious use', pattern: /(malicious|weapon|cyber(attack)?)/i, baseConfidence: 0.6, rationale: 'malicious-use surface' },
  { framework: 'MIT_AIR', category: '5.1 Overreliance', pattern: /(over[- ]?reliance|automation bias)/i, baseConfidence: 0.6, rationale: 'human-machine interaction' },
  { framework: 'MIT_AIR', category: '7.1 System safety', pattern: /(runaway|loop|recursive|unbounded)/i, baseConfidence: 0.6, rationale: 'system safety failures' },

  // AVID SEP
  { framework: 'AVID', category: 'security', pattern: /(injection|exfiltrat|leak|jailbreak)/i, baseConfidence: 0.7, rationale: 'security weakness' },
  { framework: 'AVID', category: 'ethics', pattern: /(bias|discrimina|toxic|hate|fair)/i, baseConfidence: 0.7, rationale: 'ethics weakness' },
  { framework: 'AVID', category: 'performance', pattern: /(drift|degradation|accuracy|latency|cost)/i, baseConfidence: 0.6, rationale: 'performance weakness' },

  // MITRE ATLAS
  { framework: 'ATLAS', category: 'ml_attack_staging', pattern: /(adversarial|evas(ion|ive)|fgsm|pgd)/i, baseConfidence: 0.75, rationale: 'staging attacks on ML' },
  { framework: 'ATLAS', category: 'ml_model_access', pattern: /(model (theft|extraction|stealing))/i, baseConfidence: 0.8, rationale: 'model-access threat' },
  { framework: 'ATLAS', category: 'exfiltration', pattern: /(training data extraction|membership inference|exfiltrat)/i, baseConfidence: 0.8, rationale: 'data exfiltration' },
  { framework: 'ATLAS', category: 'impact', pattern: /(deni(al)?[- ]of[- ]service|dos|model corruption)/i, baseConfidence: 0.7, rationale: 'impact tactics' },

  // OWASP LLM Top 10 (2025)
  { framework: 'OWASP_LLM10', category: 'LLM01 Prompt Injection', pattern: /(prompt injection|jailbreak)/i, baseConfidence: 0.85, rationale: 'OWASP LLM01' },
  { framework: 'OWASP_LLM10', category: 'LLM02 Sensitive Information Disclosure', pattern: /(pii|leak|sensitive (data|info))/i, baseConfidence: 0.7, rationale: 'OWASP LLM02' },
  { framework: 'OWASP_LLM10', category: 'LLM03 Supply Chain', pattern: /(supply chain|third[- ]party model|compromised dependency)/i, baseConfidence: 0.7, rationale: 'OWASP LLM03' },
  { framework: 'OWASP_LLM10', category: 'LLM04 Data and Model Poisoning', pattern: /(poison|backdoor|tainted data)/i, baseConfidence: 0.8, rationale: 'OWASP LLM04' },
  { framework: 'OWASP_LLM10', category: 'LLM05 Improper Output Handling', pattern: /(xss|sql injection|unsanitized output)/i, baseConfidence: 0.7, rationale: 'OWASP LLM05' },
  { framework: 'OWASP_LLM10', category: 'LLM06 Excessive Agency', pattern: /(autonomous|excess(ive)? (agency|permission)|tool)/i, baseConfidence: 0.6, rationale: 'OWASP LLM06' },
  { framework: 'OWASP_LLM10', category: 'LLM07 System Prompt Leakage', pattern: /(system prompt leak)/i, baseConfidence: 0.85, rationale: 'OWASP LLM07' },
  { framework: 'OWASP_LLM10', category: 'LLM08 Vector and Embedding Weaknesses', pattern: /(embedding|vector (store|db))/i, baseConfidence: 0.6, rationale: 'OWASP LLM08' },
  { framework: 'OWASP_LLM10', category: 'LLM09 Misinformation', pattern: /(hallucinat|misinform)/i, baseConfidence: 0.75, rationale: 'OWASP LLM09' },
  { framework: 'OWASP_LLM10', category: 'LLM10 Unbounded Consumption', pattern: /(unbounded|cost runaway|denial of wallet)/i, baseConfidence: 0.7, rationale: 'OWASP LLM10' },
];

export interface ClassificationResult {
  euAiActTier: EuAiActTier;
  euAiActRationale: string;
  matchedRuleId: string;
  nistRecommendations: NistAiRmfSubcategory[];
  taxonomyMatches: RiskMatch[];
}

/**
 * RiskClassificationHelper — advisory classifier mapping (system, use-case)
 * to:
 *   - EU AI Act risk tier (with rationale)
 *   - NIST AI RMF subcategory recommendations
 *   - MIT AIR / AVID / MITRE ATLAS / OWASP LLM Top-10 matched categories
 *
 * The helper is *advisory*. Final classification is the auditor's call —
 * it is recorded on AiSystem.riskClassification only after auditor accept.
 *
 * Mapping refs:
 *  - design § 3.3 Risk Classification Helper
 *  - EU AI Act Reg (EU) 2024/1689 Articles 5, 6, 50, 51–55, Annex III
 *  - NIST AI RMF 1.0 (NIST AI 100-1)
 *  - OWASP LLM Top 10 (2025)
 */
export class RiskClassificationHelper {
  /** Classify a system end-to-end. */
  classify(system: AiSystem): ClassificationResult {
    const tierResult = this.classifyEuAiAct(system);
    return {
      euAiActTier: tierResult.tier,
      euAiActRationale: tierResult.rationale,
      matchedRuleId: tierResult.ruleId,
      nistRecommendations: this.recommendNist(system.kind),
      taxonomyMatches: this.matchTaxonomies(system),
    };
  }

  /** EU AI Act tiering only — exposed for unit-test of the rule corpus. */
  classifyEuAiAct(system: AiSystem): {
    tier: EuAiActTier;
    rationale: string;
    ruleId: string;
  } {
    const lower = `${system.useCaseDescription} ${system.description ?? ''} ${system.name}`.toLowerCase();
    const sorted = [...RULES].sort((a, b) => b.priority - a.priority);
    for (const rule of sorted) {
      if (rule.when(system, lower)) {
        return { tier: rule.tier, rationale: rule.rationale, ruleId: rule.id };
      }
    }
    return { tier: 'minimal_risk', rationale: 'no rule matched', ruleId: 'minimal_default' };
  }

  /** NIST AI RMF subcategory recommendations for an AiSystemKind. */
  recommendNist(kind: AiSystemKind): NistAiRmfSubcategory[] {
    return [...(NIST_BY_KIND[kind] ?? [])];
  }

  /** Match keywords against MIT AIR / AVID / ATLAS / OWASP LLM10. */
  matchTaxonomies(system: AiSystem): RiskMatch[] {
    const corpus = `${system.name} ${system.description ?? ''} ${system.useCaseDescription}`.toLowerCase();
    const matches: RiskMatch[] = [];
    for (const k of KEYWORDS) {
      if (k.pattern.test(corpus)) {
        matches.push({
          framework: k.framework,
          category: k.category,
          confidence: k.baseConfidence,
          rationale: k.rationale,
        });
      }
    }
    // Always include kind-derived OWASP LLM06 for agents.
    if (
      isAgentKind(system.kind) &&
      !matches.some((m) => m.framework === 'OWASP_LLM10' && m.category.startsWith('LLM06'))
    ) {
      matches.push({
        framework: 'OWASP_LLM10',
        category: 'LLM06 Excessive Agency',
        confidence: 0.7,
        rationale: 'agent kind has tool-using agency by definition',
      });
    }
    return this.topN(matches, 10);
  }

  private topN(matches: RiskMatch[], n: number): RiskMatch[] {
    return [...matches].sort((a, b) => b.confidence - a.confidence).slice(0, n);
  }
}
