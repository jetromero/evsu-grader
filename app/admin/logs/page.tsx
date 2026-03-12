'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Card, { CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import {
  ScrollText, Search, Filter,
  PlusCircle, Pencil, Trash2, Lock, Unlock, FileText, Users, CalendarDays, GraduationCap, ClipboardCheck
} from 'lucide-react';

interface LogEntry {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const actionIcons: Record<string, typeof PlusCircle> = {
  created: PlusCircle,
  updated: Pencil,
  deleted: Trash2,
  finalized: Lock,
  reopened: Unlock,
  exported: FileText,
  imported: Users,
  graded: ClipboardCheck,
};

const entityColors: Record<string, string> = {
  session: 'bg-blue-50 text-blue-600',
  student: 'bg-emerald-50 text-emerald-600',
  panelist: 'bg-purple-50 text-purple-600',
  grade: 'bg-orange-50 text-orange-500',
  result: 'bg-evsu-maroon/[0.07] text-evsu-maroon',
};

export default function AdminLogsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [page, entityFilter, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (entityFilter) query = query.eq('entity_type', entityFilter);
    if (actionFilter) query = query.ilike('action', `%${actionFilter}%`);

    const { data, count } = await query;
    setLogs(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  const filtered = search
    ? logs.filter(l => {
        const q = search.toLowerCase();
        return (
          l.user_name?.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q) ||
          JSON.stringify(l.details ?? {}).toLowerCase().includes(q)
        );
      })
    : logs;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getActionWord = (action: string): string => {
    const lower = action.toLowerCase();
    for (const key of Object.keys(actionIcons)) {
      if (lower.includes(key)) return key;
    }
    return 'created';
  };

  if (loading && page === 1) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-border rounded animate-pulse" />
          <div className="h-8 w-40 bg-border rounded-xl animate-pulse" />
        </div>
        <div className="h-12 bg-border rounded-xl animate-pulse" />
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-16 bg-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-text-faint uppercase mb-1">System</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">Activity Logs</h1>
        <p className="text-sm text-text-muted mt-1">Track all operations performed in the system</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-evsu-maroon/20 focus:border-evsu-maroon"
          />
        </div>
        <Select
          value={entityFilter}
          onChange={v => { setEntityFilter(v); setPage(1); }}
          options={[
            { value: '', label: 'All Types' },
            { value: 'session', label: 'Sessions' },
            { value: 'student', label: 'Students' },
            { value: 'panelist', label: 'Panelists' },
            { value: 'grade', label: 'Grades' },
            { value: 'result', label: 'Results' },
          ]}
          className="w-44"
        />
      </div>

      {/* Log entries */}
      <Card>
        <div className="divide-y divide-border-subtle">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-text-muted">
              <ScrollText size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">No activity logs found</p>
              <p className="text-xs mt-1">Logs will appear as operations are performed.</p>
            </div>
          ) : (
            filtered.map(log => {
              const actionWord = getActionWord(log.action);
              const IconComp = actionIcons[actionWord] || PlusCircle;
              const entityColor = entityColors[log.entity_type] || 'bg-gray-50 text-gray-600';

              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface transition-colors">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${entityColor}`}>
                    <IconComp size={14} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">
                      <span className="font-semibold">{log.user_name}</span>
                      {' '}
                      <span className="text-text-muted">{log.action}</span>
                    </p>
                    {log.details && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {Object.entries(log.details)
                          .filter(([_, v]) => v !== null && v !== undefined)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Entity badge */}
                  <Badge variant="default" className="flex-shrink-0 text-[10px] capitalize">{log.entity_type}</Badge>

                  {/* Timestamp */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-text-muted">{formatDate(log.created_at)}</p>
                    <p className="text-[10px] text-text-faint font-mono">{formatTime(log.created_at)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
