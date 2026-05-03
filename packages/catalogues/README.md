# @auditforge/catalogues

Reference catalogue data and a typed loader.

## Data files (`data/`)

| File | Source | Notes |
|------|--------|-------|
| `iso-42001-clauses.json` | ISO/IEC 42001:2023 | Clause numbers + neutral titles only. **No copyrighted clause text.** |
| `annex-a-controls.json` | ISO/IEC 42001:2023 Annex A | Control identifiers + neutral titles only. |
| `eu-ai-act-articles.json` | Regulation (EU) 2024/1689 | Article numbers + titles + risk-tier mapping. EU regulations are public domain. |
| `nist-ai-rmf-subcategories.json` | NIST AI RMF 1.0 | Public-domain US Government work. GOVERN/MAP/MEASURE/MANAGE. |
| `owasp-llm-top-10-2025.json` | OWASP LLM Top 10 (2025 release) | CC-BY-SA. |
| `mitre-atlas-techniques.json` | MITRE ATLAS | Top-tier techniques. |
| `avid-categories.json` | AVID (AI Vulnerability Database) | Top-level taxonomy. |
| `mit-ai-risk-categories.json` | MIT AI Risk Repository | Top categories. |
| `framework-mappings.json` | SME-curated | Edges between catalogue nodes. See ADR-0008. |

The ISO 42001 clause and Annex A control catalogues hold **identifiers and
paraphrased neutral descriptions only**. The official clause text is ISO
copyright and must be sourced from a licensed copy of the standard at runtime
(see Section 3.14 "Standard Text Reference").

## Loader

```ts
import { loadAllCatalogues } from '@auditforge/catalogues';
const all = await loadAllCatalogues();
all.iso42001Clauses;       // ClauseRef[]
all.annexAControls;        // AnnexAControlRef[]
all.euAiActArticles;       // EuAiActArticleRef[]
all.nistAiRmfSubcategories; // NistAiRmfSubcategoryRef[]
all.owaspLlmTop10;         // OwaspLlmRiskRef[]
all.mitreAtlasTechniques;  // MitreAtlasTechniqueRef[]
all.avidCategories;        // AvidCategoryRef[]
all.mitAiRiskCategories;   // MitAiRiskCategoryRef[]
all.frameworkMappings;     // FrameworkMappingRef[]
```

The DB seed step (`packages/db/src/seed`) imports this loader and inserts the
catalogue rows.
