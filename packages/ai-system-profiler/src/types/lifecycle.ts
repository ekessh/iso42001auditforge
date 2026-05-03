// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

/**
 * AI system lifecycle stages — aligned with ISO/IEC 42001 clause 8.2 (AI
 * system life-cycle) + ISO/IEC 5338. Used to scope evidence and probes
 * by stage.
 */
export const LifecycleStageSchema = z.enum([
  'inception',
  'design',
  'data_acquisition',
  'training',
  'evaluation',
  'verification',
  'deployment',
  'operation',
  'monitoring',
  'retirement',
]);
export type LifecycleStage = z.infer<typeof LifecycleStageSchema>;

/**
 * Deployment context. Maps to NIST AI RMF MEASURE 2.4 (deployment context)
 * and EU AI Act Article 50 transparency obligations for systems
 * interacting with natural persons.
 */
export const DeploymentContextSchema = z.enum([
  'cloud_saas',
  'cloud_dedicated',
  'on_prem',
  'edge_device',
  'mobile_device',
  'browser_extension',
  'desktop_app',
  'api_only',
  'hybrid',
]);
export type DeploymentContext = z.infer<typeof DeploymentContextSchema>;

/**
 * Autonomy level per AuditForge taxonomy (design § 3.6 — Autonomy Level
 * Classifier). Used to drive HITL gate verification and EU AI Act
 * Article 14 (human oversight) review.
 *
 *  - 1 = suggest (system proposes; human acts)
 *  - 2 = execute_with_approval (system acts only after explicit human approval)
 *  - 3 = execute_with_audit (system acts; human reviews after the fact)
 *  - 4 = execute_autonomous (system acts without human review)
 */
export const AutonomyLevelSchema = z
  .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
  .describe('1=suggest|2=execute_with_approval|3=execute_with_audit|4=execute_autonomous');
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;

export const AUTONOMY_LABELS: Readonly<Record<AutonomyLevel, string>> = Object.freeze({
  1: 'suggest',
  2: 'execute_with_approval',
  3: 'execute_with_audit',
  4: 'execute_autonomous',
});
