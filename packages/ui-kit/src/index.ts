// SPDX-License-Identifier: BUSL-1.1
/**
 * @auditforge/ui-kit — design system for the AuditForge ISO 42001 workbench.
 *
 * Re-exports primitives, audit-domain components, hooks, and layouts.
 * Tailwind preset is at `@auditforge/ui-kit/tailwind.preset`; global styles at
 * `@auditforge/ui-kit/styles.css`.
 */

// ---- Tokens ----------------------------------------------------------------
export * from './tokens';
export { cn } from './lib/cn';

// ---- Primitives ------------------------------------------------------------
export * from './components/Alert';
export * from './components/Avatar';
export * from './components/Badge';
export * from './components/Breadcrumb';
export * from './components/Button';
export * from './components/Calendar';
export * from './components/Card';
export * from './components/Checkbox';
export * from './components/CodeBlock';
export * from './components/Combobox';
export * from './components/Command';
export * from './components/ContextMenu';
export * from './components/DataTable';
export * from './components/DatePicker';
export * from './components/Diff';
export * from './components/Dialog';
export * from './components/Drawer';
export * from './components/DropdownMenu';
export * from './components/EmptyState';
export * from './components/ErrorBoundary';
export * from './components/FileDropzone';
export * from './components/Input';
export * from './components/KanbanBoard';
export * from './components/LoadingScreen';
export * from './components/NavigationMenu';
export * from './components/Pagination';
export * from './components/Popover';
export * from './components/Progress';
export * from './components/Radio';
export * from './components/ResizablePanels';
export * from './components/RichTextEditor';
export * from './components/ScrollArea';
export * from './components/Select';
export * from './components/Separator';
export * from './components/Sheet';
export * from './components/Skeleton';
export * from './components/Stepper';
export * from './components/Switch';
export * from './components/Table';
export * from './components/Tabs';
export * from './components/Timeline';
export * from './components/Toaster';
export * from './components/Tooltip';
export * from './components/Tree';

// ---- Domain ----------------------------------------------------------------
export * from './domain/AuditorAvatar';
export * from './domain/ClauseRef';
export * from './domain/ConfidenceMeter';
export * from './domain/EvidenceLink';
export * from './domain/LedgerEventRow';
export * from './domain/NCStatePill';
export * from './domain/ProbeResultCard';
export * from './domain/SignatureStatus';
export * from './domain/ToolACLDriftDiff';
export * from './domain/TraceTimeline';
export * from './domain/VerdictPill';

// ---- Hooks -----------------------------------------------------------------
export * from './hooks';

// ---- Layouts ---------------------------------------------------------------
export * from './layouts';
