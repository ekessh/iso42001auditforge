// SPDX-License-Identifier: BUSL-1.1
'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Command,
  FileSearch,
  FlaskConical,
  Folder,
  GanttChart,
  HardDriveDownload,
  HelpCircle,
  Home,
  Library,
  Search,
  Settings,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { AuditorAvatar, type AuditorRole } from '../domain/AuditorAvatar';
import { Button } from '../components/Button';
import { Tooltip } from '../components/Tooltip';
import { useCommandPalette } from '../hooks/useCommandPalette';

export interface AuditorShellNavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  shortcut?: string;
}

export interface AuditorShellProps {
  /** Current route path used for active matching. */
  pathname?: string;
  /** Active firm + auditor identity. */
  identity: { name: string; role: AuditorRole; firm: string; src?: string };
  /** Optional offline indicator. */
  offline?: boolean;
  /** Density value reflected on data-density. */
  density?: 'comfortable' | 'compact';
  onDensityChange?: (next: 'comfortable' | 'compact') => void;
  theme?: 'dark' | 'light';
  onThemeChange?: (next: 'dark' | 'light') => void;
  /** Renderer for the left-rail navigation link (e.g. Next.js <Link>). */
  renderNavLink?: (item: AuditorShellNavItem, content: React.ReactNode) => React.ReactNode;
  /** Slot for the top-right action buttons. */
  topRightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const defaultNav: AuditorShellNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <Home />, shortcut: 'G H' },
  { href: '/clients', label: 'Clients', icon: <Users />, shortcut: 'G C' },
  { href: '/engagements', label: 'Engagements', icon: <Folder />, shortcut: 'G E' },
  { href: '/findings', label: 'Findings', icon: <FileSearch />, shortcut: 'G F' },
  { href: '/probes', label: 'Probes', icon: <FlaskConical />, shortcut: 'G P' },
  { href: '/traces', label: 'Traces', icon: <GanttChart />, shortcut: 'G T' },
  { href: '/calendar', label: 'Calendar', icon: <CalendarDays />, shortcut: 'G K' },
  { href: '/library', label: 'Library', icon: <Library />, shortcut: 'G L' },
];

const bottomNav: AuditorShellNavItem[] = [
  { href: '/settings', label: 'Settings', icon: <Settings />, shortcut: 'G S' },
];

export const AuditorShell = ({
  pathname = '/',
  identity,
  offline,
  density = 'comfortable',
  onDensityChange,
  theme = 'dark',
  onThemeChange,
  renderNavLink,
  topRightSlot,
  children,
  className,
}: AuditorShellProps) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const palette = useCommandPalette();

  const renderItem = (item: AuditorShellNavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const content = (
      <span
        className={cn(
          'group relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active
            ? 'bg-primary/15 text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute -left-2 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity',
            active ? 'opacity-100' : 'opacity-0',
          )}
        />
        <span className="grid size-5 shrink-0 place-items-center text-muted-foreground group-hover:text-foreground [&_svg]:size-4">
          {item.icon}
        </span>
        {!collapsed ? (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? <span>{item.badge}</span> : null}
            {item.shortcut && !item.badge ? (
              <kbd className="hidden rounded border border-border bg-muted/40 px-1 py-px font-mono text-[10px] tabular text-muted-foreground group-hover:inline-flex">
                {item.shortcut}
              </kbd>
            ) : null}
          </>
        ) : null}
      </span>
    );
    const node = renderNavLink ? renderNavLink(item, content) : <a href={item.href}>{content}</a>;
    return (
      <li key={item.href}>
        {collapsed ? (
          <Tooltip label={item.label} side="right">
            {node as React.ReactElement}
          </Tooltip>
        ) : (
          node
        )}
      </li>
    );
  };

  return (
    <div
      data-density={density}
      data-theme={theme}
      className={cn('grid h-screen w-screen grid-cols-[auto_1fr] grid-rows-[auto_1fr] bg-background text-foreground', className)}
    >
      {/* Top bar */}
      <header
        role="banner"
        className="col-span-2 flex h-12 items-center justify-between gap-3 border-b border-border bg-card/80 px-3 backdrop-blur"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-primary to-navy-700 text-primary-foreground"
          >
            <ShieldCheck className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-xs font-semibold tracking-tight">AuditForge</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              ISO 42001 Workbench
            </p>
          </div>
          <span className="mx-2 hidden h-5 w-px bg-border md:inline-block" />
          <span className="hidden truncate text-xs text-muted-foreground md:block">
            {identity.firm}
          </span>
        </div>

        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          className={cn(
            'group hidden flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'md:inline-flex md:max-w-md',
          )}
          aria-label="Open command palette"
        >
          <Search className="size-3.5" aria-hidden />
          <span className="flex-1 text-left">Search clients, engagements, clauses, probes…</span>
          <kbd className="rounded border border-border bg-card px-1 py-px font-mono text-[10px] tabular text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-1.5">
          {offline ? (
            <span
              role="status"
              className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-2xs font-medium text-warning"
            >
              <WifiOff className="size-3" aria-hidden /> Offline · syncing locally
            </span>
          ) : null}
          {topRightSlot}
          <Tooltip label="Keyboard shortcuts">
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Keyboard shortcuts"
              onClick={() => window.dispatchEvent(new CustomEvent('af:open-shortcuts'))}
            >
              <CircleHelp className="size-4" aria-hidden />
            </button>
          </Tooltip>
          <Tooltip label="Density">
            <button
              type="button"
              onClick={() => onDensityChange?.(density === 'comfortable' ? 'compact' : 'comfortable')}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Switch to ${density === 'comfortable' ? 'compact' : 'comfortable'} density`}
            >
              <HardDriveDownload className="size-4" aria-hidden />
            </button>
          </Tooltip>
          <Tooltip label="Theme">
            <button
              type="button"
              onClick={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <Command className="size-4" aria-hidden />
            </button>
          </Tooltip>
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-card pr-2">
            <AuditorAvatar
              name={identity.name}
              role={identity.role}
              size="sm"
              {...(identity.src !== undefined ? { src: identity.src } : {})}
            />
            <span className="hidden text-xs font-medium md:inline">{identity.name}</span>
          </span>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        aria-label="Primary navigation"
        className={cn(
          'flex flex-col border-r border-border bg-card/40 transition-[width] duration-base',
          collapsed ? 'w-12' : 'w-56',
        )}
      >
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <ul className="flex flex-col gap-0.5">{defaultNav.map(renderItem)}</ul>
        </nav>
        <ul className="flex flex-col gap-0.5 border-t border-border px-2 py-2">{bottomNav.map(renderItem)}</ul>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={() => setCollapsed((v) => !v)}
            className="w-full justify-center"
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        </div>
      </aside>

      {/* Workspace */}
      <main role="main" className="overflow-auto">
        {children}
      </main>
    </div>
  );
};

export const AuditeePortalShell = ({
  clientName,
  engagementCode,
  children,
}: {
  clientName: string;
  engagementCode: string;
  children: React.ReactNode;
}) => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <header role="banner" className="border-b border-border bg-card px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-primary to-navy-700 text-primary-foreground"
          >
            <ShieldCheck className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-xs font-semibold">{clientName}</p>
            <p className="text-[10px] text-muted-foreground">Engagement {engagementCode}</p>
          </div>
        </div>
        <a
          href="/auditee/help"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="size-3.5" aria-hidden />
          Need help?
        </a>
      </div>
    </header>
    <main role="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      {children}
    </main>
    <footer className="border-t border-border bg-card/40 px-4 py-2 text-center text-2xs text-muted-foreground">
      Auditee portal — Limited access · BUSL-1.1
    </footer>
  </div>
);

export const AccreditationPortalShell = ({
  fileId,
  children,
}: {
  fileId: string;
  children: React.ReactNode;
}) => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <header role="banner" className="border-b border-border bg-card px-4 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-neutral-700 text-white"
          >
            <ShieldCheck className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-xs font-semibold">Accreditation Portal</p>
            <p className="font-mono text-[10px] tabular text-muted-foreground">File {fileId} · read-only</p>
          </div>
        </div>
        <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-2xs text-warning">
          Read-only inspection
        </span>
      </div>
    </header>
    <main role="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      {children}
    </main>
  </div>
);
