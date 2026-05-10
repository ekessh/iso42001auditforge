// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@auditforge/ui-kit';
import {
  LayoutDashboard,
  Users,
  Calendar,
  AlertTriangle,
  Beaker,
  Activity,
  BookOpen,
  Settings,
  FileText,
  Plus,
  Upload,
  Search as SearchIcon,
} from 'lucide-react';
import { usePalette } from './palette-store';
import { useEngagements } from '@/lib/hooks/use-engagement';
import { useClients } from '@/lib/hooks/use-clients';
import { useLibrary } from '@/lib/hooks/use-library';

const NAV_ITEMS: Array<{ href: string; label: string; icon: React.ElementType }> = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/engagements', label: 'Engagements', icon: Calendar },
  { href: '/findings', label: 'Findings', icon: AlertTriangle },
  { href: '/probes', label: 'Probes', icon: Beaker },
  { href: '/traces', label: 'Traces', icon: Activity },
  { href: '/library', label: 'Library', icon: BookOpen },
  { href: '/readiness', label: 'Readiness Dashboard', icon: FileText },
  { href: '/audit-dashboard', label: 'Audit Dashboard', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function CommandPalette() {
  const open = usePalette((s) => s.open);
  const setOpen = usePalette((s) => s.setOpen);
  const trigger = usePalette((s) => s.trigger);
  const router = useRouter();
  const [query, setQuery] = React.useState('');

  // Hotkey: Cmd+K (Mac) / Ctrl+K (Win/Linux). Avoid stomping in inputs unless focused on body.
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  // Reset query each time it opens.
  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const engagementsQ = useEngagements({ limit: 50 });
  const clientsQ = useClients({ limit: 50 });
  const libraryQ = useLibrary(query ? { q: query, limit: 25 } : { limit: 25 });

  const engagements = engagementsQ.data?.items ?? [];
  const clients = clientsQ.data?.items ?? [];
  const libraryItems = libraryQ.data?.items ?? [];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} label="AuditForge command palette">
      <CommandInput
        placeholder="Search routes, engagements, clients, library, or run an action…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => trigger('new-engagement')}>
            <Plus aria-hidden />
            <span>Start new engagement</span>
          </CommandItem>
          <CommandItem onSelect={() => trigger('raise-nc')}>
            <AlertTriangle aria-hidden />
            <span>Raise nonconformity</span>
          </CommandItem>
          <CommandItem onSelect={() => trigger('run-probe')}>
            <Beaker aria-hidden />
            <span>Run probe</span>
          </CommandItem>
          <CommandItem onSelect={() => trigger('new-client')}>
            <Users aria-hidden />
            <span>New client</span>
          </CommandItem>
          <CommandItem onSelect={() => trigger('upload-trace')}>
            <Upload aria-hidden />
            <span>Upload trace</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon aria-hidden />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {engagements.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Engagements">
              {engagements.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`engagement ${e.id} ${e.clientId} ${e.scopeStatement}`}
                  onSelect={() => go(`/engagements/${e.id}`)}
                >
                  <Calendar aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.clientId}</div>
                    <div className="text-xs text-muted-foreground truncate">{e.scopeStatement}</div>
                  </div>
                  <span className="ml-auto text-2xs text-muted-foreground font-mono">{e.id}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clients">
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`client ${c.id} ${c.name}`}
                  onSelect={() => go(`/clients/${c.id}`)}
                >
                  <Users aria-hidden />
                  <span>{c.name}</span>
                  <span className="ml-auto text-2xs text-muted-foreground font-mono">{c.id}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {query.length >= 2 && libraryItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Library (${libraryItems.length})`}>
              {libraryItems.slice(0, 12).map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={`library ${entry.ref} ${entry.title} ${entry.body ?? ''}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(`/library?q=${encodeURIComponent(entry.ref)}`);
                  }}
                >
                  <SearchIcon aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{entry.title}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{entry.ref}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
