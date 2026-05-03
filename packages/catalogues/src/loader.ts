// SPDX-License-Identifier: BUSL-1.1
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  AnnexAControlRefSchema,
  AvidCategoryRefSchema,
  ClauseRefSchema,
  EuAiActArticleRefSchema,
  FrameworkMappingEdgeSchema,
  MitAiRiskCategoryRefSchema,
  MitreAtlasTechniqueRefSchema,
  NistAiRmfSubcategoryRefSchema,
  OwaspLlmRiskRefSchema,
  type AnnexAControlRef,
  type AvidCategoryRef,
  type ClauseRef,
  type EuAiActArticleRef,
  type FrameworkMappingEdge,
  type MitAiRiskCategoryRef,
  type MitreAtlasTechniqueRef,
  type NistAiRmfSubcategoryRef,
  type OwaspLlmRiskRef,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = (): string => join(__dirname, '..', 'data');

async function loadJson<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(join(dataDir(), file), 'utf8');
  const json: unknown = JSON.parse(raw);
  return schema.parse(json);
}

const ClauseFileSchema = z.object({
  framework: z.string(),
  note: z.string().optional(),
  clauses: z.array(ClauseRefSchema),
});

const AnnexAFileSchema = z.object({
  framework: z.string(),
  note: z.string().optional(),
  controls: z.array(AnnexAControlRefSchema),
});

const EuAiActFileSchema = z.object({
  framework: z.string(),
  note: z.string().optional(),
  articles: z.array(EuAiActArticleRefSchema),
});

const NistFileSchema = z.object({
  framework: z.string(),
  note: z.string().optional(),
  subcategories: z.array(NistAiRmfSubcategoryRefSchema),
});

const OwaspFileSchema = z.object({
  framework: z.string(),
  version: z.string(),
  license: z.string(),
  risks: z.array(OwaspLlmRiskRefSchema),
});

const MitreFileSchema = z.object({
  framework: z.string(),
  note: z.string().optional(),
  techniques: z.array(MitreAtlasTechniqueRefSchema),
});

const AvidFileSchema = z.object({
  framework: z.string(),
  note: z.string().optional(),
  categories: z.array(AvidCategoryRefSchema),
});

const MitAiRiskFileSchema = z.object({
  framework: z.string(),
  note: z.string().optional(),
  categories: z.array(MitAiRiskCategoryRefSchema),
});

const MappingsFileSchema = z.object({
  note: z.string().optional(),
  edges: z.array(FrameworkMappingEdgeSchema),
});

export async function loadIso42001Clauses(): Promise<ClauseRef[]> {
  const file = await loadJson('iso-42001-clauses.json', ClauseFileSchema);
  return file.clauses;
}

export async function loadAnnexAControls(): Promise<AnnexAControlRef[]> {
  const file = await loadJson('annex-a-controls.json', AnnexAFileSchema);
  return file.controls;
}

export async function loadEuAiActArticles(): Promise<EuAiActArticleRef[]> {
  const file = await loadJson('eu-ai-act-articles.json', EuAiActFileSchema);
  return file.articles;
}

export async function loadNistAiRmfSubcategories(): Promise<NistAiRmfSubcategoryRef[]> {
  const file = await loadJson('nist-ai-rmf-subcategories.json', NistFileSchema);
  return file.subcategories;
}

export async function loadOwaspLlmTop10(): Promise<OwaspLlmRiskRef[]> {
  const file = await loadJson('owasp-llm-top-10-2025.json', OwaspFileSchema);
  return file.risks;
}

export async function loadMitreAtlasTechniques(): Promise<MitreAtlasTechniqueRef[]> {
  const file = await loadJson('mitre-atlas-techniques.json', MitreFileSchema);
  return file.techniques;
}

export async function loadAvidCategories(): Promise<AvidCategoryRef[]> {
  const file = await loadJson('avid-categories.json', AvidFileSchema);
  return file.categories;
}

export async function loadMitAiRiskCategories(): Promise<MitAiRiskCategoryRef[]> {
  const file = await loadJson('mit-ai-risk-categories.json', MitAiRiskFileSchema);
  return file.categories;
}

export async function loadFrameworkMappings(): Promise<FrameworkMappingEdge[]> {
  const file = await loadJson('framework-mappings.json', MappingsFileSchema);
  return file.edges;
}

export interface AllCatalogues {
  iso42001Clauses: ClauseRef[];
  annexAControls: AnnexAControlRef[];
  euAiActArticles: EuAiActArticleRef[];
  nistAiRmfSubcategories: NistAiRmfSubcategoryRef[];
  owaspLlmTop10: OwaspLlmRiskRef[];
  mitreAtlasTechniques: MitreAtlasTechniqueRef[];
  avidCategories: AvidCategoryRef[];
  mitAiRiskCategories: MitAiRiskCategoryRef[];
  frameworkMappings: FrameworkMappingEdge[];
}

export async function loadAllCatalogues(): Promise<AllCatalogues> {
  const [
    iso42001Clauses,
    annexAControls,
    euAiActArticles,
    nistAiRmfSubcategories,
    owaspLlmTop10,
    mitreAtlasTechniques,
    avidCategories,
    mitAiRiskCategories,
    frameworkMappings,
  ] = await Promise.all([
    loadIso42001Clauses(),
    loadAnnexAControls(),
    loadEuAiActArticles(),
    loadNistAiRmfSubcategories(),
    loadOwaspLlmTop10(),
    loadMitreAtlasTechniques(),
    loadAvidCategories(),
    loadMitAiRiskCategories(),
    loadFrameworkMappings(),
  ]);
  return {
    iso42001Clauses,
    annexAControls,
    euAiActArticles,
    nistAiRmfSubcategories,
    owaspLlmTop10,
    mitreAtlasTechniques,
    avidCategories,
    mitAiRiskCategories,
    frameworkMappings,
  };
}
