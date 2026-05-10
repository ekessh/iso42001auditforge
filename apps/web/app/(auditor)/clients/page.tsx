// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Users, Plus, Pencil } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useClients } from '@/lib/hooks/use-clients';
import { ArchiveClientButton, EditClientModal, NewClientModal } from '@/components/modals/ClientModals';
import type { Client } from '@auditforge/api-client';

export default function ClientsPage() {
  const { data, isLoading, error } = useClients({ limit: 100 });
  const items = data?.items ?? [];
  const [newOpen, setNewOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Client | null>(null);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">Auditee organizations under AIMS certification.</p>
        </div>
        <Button size="sm" iconLeft={<Plus />} onClick={() => setNewOpen(true)}>New client</Button>
      </div>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Failed to load clients'}
        </Alert>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Users />}
          title="No clients yet"
          description="Add your first auditee organisation to plan an engagement."
          action={<Button size="sm" iconLeft={<Plus />} onClick={() => setNewOpen(true)}>New client</Button>}
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => (
            <article key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-2">
              <header className="flex items-start justify-between gap-2">
                <Link
                  href={`/clients/${c.id}`}
                  className="text-base font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {c.name}
                </Link>
                <Badge tone="neutral">{c.firmId}</Badge>
              </header>
              <div className="text-xs text-slate-500 font-mono">{c.id}</div>
              <div className="text-xs text-slate-500">
                Updated {new Date(c.updatedAt).toLocaleDateString()}
              </div>
              <div className="mt-auto flex items-center justify-end gap-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="ghost" size="xs" iconLeft={<Pencil />} onClick={() => setEditing(c)}>
                  Edit
                </Button>
                <ArchiveClientButton client={c} />
              </div>
            </article>
          ))}
        </div>
      )}

      <NewClientModal open={newOpen} onOpenChange={setNewOpen} />
      {editing ? (
        <EditClientModal
          open={Boolean(editing)}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          client={editing}
        />
      ) : null}
    </div>
  );
}
