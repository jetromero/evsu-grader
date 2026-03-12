'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import Card, { CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import {
  Trophy, Search, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, Pencil
} from 'lucide-react';

interface ResultRow {
  id: string;
  student_id: string;
  session_id: string;
  avg_score: number;
  panel_count: number;
  verdict: string;
  override_verdict: string | null;
  override_reason: string | null;
  finalized_at: string | null;
  student: { student_id: string; last_name: string; given_name: string; program: string } | null;
  session: { name: string; interview_date: string; program: string } | null;
}

export default function ProgramHeadResultsPage() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'avg_score' | 'last_name'>('avg_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (profile) fetchResults();
  }, [profile]);

  const fetchResults = async () => {
    const { data } = await supabase
      .from('results')
      .select('*, student:students(student_id, last_name, given_name, program), session:sessions(name, interview_date, program)')
      .order('avg_score', { ascending: false });

    const program = profile?.program?.toUpperCase() ?? '';
    setResults(
      (data ?? []).filter((r: ResultRow) =>
        r.student?.program?.toUpperCase() === program ||
        r.session?.program?.toUpperCase() === program
      )
    );
    setLoading(false);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filtered = results
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      const name = `${r.student?.last_name} ${r.student?.given_name}`.toLowerCase();
      const sid = r.student?.student_id?.toLowerCase() ?? '';
      return name.includes(q) || sid.includes(q);
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'avg_score') return (a.avg_score - b.avg_score) * dir;
      return (a.student?.last_name ?? '').localeCompare(b.student?.last_name ?? '') * dir;
    });

  const effectiveVerdict = (r: ResultRow) => r.override_verdict ?? r.verdict;

  const qualified = results.filter(r => effectiveVerdict(r) === 'qualified').length;
  const notQualified = results.filter(r => effectiveVerdict(r) === 'not_qualified').length;
  const disqualified = results.filter(r => effectiveVerdict(r) === 'disqualified').length;

  const verdictBadge = (v: string) => {
    if (v === 'qualified') return <Badge variant="success">Qualified</Badge>;
    if (v === 'disqualified') return <Badge variant="danger">Disqualified</Badge>;
    return <Badge variant="warning">Not Qualified</Badge>;
  };

  if (!profile?.program) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-text-muted">
          <Trophy size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No program assigned to your account.</p>
          <p className="text-xs mt-1">Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-border rounded animate-pulse" />
          <div className="h-8 w-48 bg-border rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-border rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-12 bg-border rounded-xl animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-text-faint uppercase mb-1">Read-Only View</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">Results</h1>
        <p className="text-sm text-text-muted mt-1">
          Program: <span className="font-semibold text-evsu-maroon">{profile.program}</span>
          {' · '}{results.length} finalized results
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Trophy size={18} />
            </div>
            <div>
              <p className="text-xl font-bold font-mono">{results.length}</p>
              <p className="text-xs text-text-muted">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle size={18} />
            </div>
            <div>
              <p className="text-xl font-bold font-mono text-green-600">{qualified}</p>
              <p className="text-xs text-text-muted">Qualified</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
              <XCircle size={18} />
            </div>
            <div>
              <p className="text-xl font-bold font-mono text-orange-500">{notQualified}</p>
              <p className="text-xs text-text-muted">Not Qualified</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-xl font-bold font-mono text-red-600">{disqualified}</p>
              <p className="text-xs text-text-muted">Disqualified</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or student ID..."
          className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-evsu-maroon/20 focus:border-evsu-maroon"
        />
      </div>

      {/* Results table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                <th className="text-left px-4 py-3 font-medium text-text-muted">#</th>
                <th
                  className="text-left px-4 py-3 font-medium text-text-muted hover:text-text-primary cursor-pointer"
                  onClick={() => toggleSort('last_name')}
                >
                  <span className="inline-flex items-center gap-1">
                    Student
                    {sortField === 'last_name' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">ID</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Session</th>
                <th
                  className="text-center px-4 py-3 font-medium text-text-muted hover:text-text-primary cursor-pointer"
                  onClick={() => toggleSort('avg_score')}
                >
                  <span className="inline-flex items-center gap-1">
                    Avg Score
                    {sortField === 'avg_score' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </span>
                </th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">Panels</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtered.map((r, idx) => (
                <tr key={r.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">
                      {r.student?.last_name}, {r.student?.given_name}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{r.student?.student_id}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{r.session?.name}</td>
                  <td className="text-center px-4 py-3">
                    <span className="font-mono font-bold">{r.avg_score?.toFixed(2)}</span>
                  </td>
                  <td className="text-center px-4 py-3 font-mono text-xs">{r.panel_count}</td>
                  <td className="text-center px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {verdictBadge(effectiveVerdict(r))}
                      {r.override_verdict && (
                        <span title={r.override_reason ?? 'Override applied by admin'}>
                          <Pencil size={11} className="text-orange-400 cursor-help" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-text-muted">
            <Trophy size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No results found</p>
            <p className="text-xs mt-1">
              {results.length === 0
                ? 'No finalized results for your program yet.'
                : 'Try adjusting your search.'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
