'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { logActivity } from '@/lib/activity-log';
import Card, { CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import {
  Trophy, Search, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle,
  Download, FileSpreadsheet, FileText, Pencil
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

export default function AdminResultsPage() {
  const { profile: authProfile } = useAuth();
  const supabase = createClient();
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [sortField, setSortField] = useState<'avg_score' | 'last_name' | 'finalized_at'>('avg_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<ResultRow | null>(null);
  const [overrideForm, setOverrideForm] = useState({ verdict: '', reason: '' });
  const [savingOverride, setSavingOverride] = useState(false);
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [resultsRes, sessionsRes] = await Promise.all([
      supabase
        .from('results')
        .select('*, student:students(student_id, last_name, given_name, program), session:sessions(name, interview_date, program)')
        .order('avg_score', { ascending: false }),
      supabase.from('sessions').select('id, name').eq('status', 'finalized'),
    ]);

    setResults(resultsRes.data ?? []);
    setSessions(sessionsRes.data ?? []);
    setLoading(false);
  };

  const filtered = results
    .filter(r => {
      const effectiveVerdict = r.override_verdict ?? r.verdict;
      if (verdictFilter && effectiveVerdict !== verdictFilter) return false;
      if (sessionFilter && r.session_id !== sessionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = `${r.student?.last_name} ${r.student?.given_name}`.toLowerCase();
        const sid = r.student?.student_id?.toLowerCase() ?? '';
        if (!name.includes(q) && !sid.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'avg_score') return (a.avg_score - b.avg_score) * dir;
      if (sortField === 'last_name') return (a.student?.last_name ?? '').localeCompare(b.student?.last_name ?? '') * dir;
      return ((a.finalized_at ?? '') > (b.finalized_at ?? '') ? 1 : -1) * dir;
    });

  const qualified = results.filter(r => (r.override_verdict ?? r.verdict) === 'qualified').length;
  const notQualified = results.filter(r => (r.override_verdict ?? r.verdict) === 'not_qualified').length;
  const disqualified = results.filter(r => (r.override_verdict ?? r.verdict) === 'disqualified').length;

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const verdictLabel = (v: string) =>
    v === 'qualified' ? 'Qualified' : v === 'disqualified' ? 'Disqualified' : 'Not Qualified';

  const getExportRows = () => filtered.map((r, i) => ({
    '#': i + 1,
    'Student ID': r.student?.student_id ?? '',
    'Last Name': r.student?.last_name ?? '',
    'First Name': r.student?.given_name ?? '',
    'Program': r.student?.program ?? '',
    'Session': r.session?.name ?? '',
    'Avg Score': r.avg_score?.toFixed(2) ?? '',
    'Panels': r.panel_count,
    'Verdict': verdictLabel(r.override_verdict ?? r.verdict),
    'Finalized': r.finalized_at ? new Date(r.finalized_at).toLocaleDateString() : '',
  }));

  const exportCsv = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const val = String((r as Record<string, unknown>)[h] ?? '');
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','))
    ].join('\n');
    downloadFile(csv, 'results.csv', 'text/csv');
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const rows = getExportRows();
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Results');
      // Auto-width columns
      ws['!cols'] = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String((r as Record<string, unknown>)[key] ?? '').length)) + 2,
      }));
      XLSX.writeFile(wb, 'EVSU_Interview_Results.xlsx');
    } catch {
      (await import('react-hot-toast')).default.error('Failed to export Excel');
    }
    setExporting(false);
    setShowExportMenu(false);
  };



  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleSaveOverride = async () => {
    if (!overrideTarget) return;
    setSavingOverride(true);
    const { error } = await supabase
      .from('results')
      .update({
        override_verdict: overrideForm.verdict || null,
        override_reason: overrideForm.reason || null,
        override_by: authProfile?.id ?? null,
        override_at: overrideForm.verdict ? new Date().toISOString() : null,
      })
      .eq('id', overrideTarget.id);
    if (error) {
      toast.error('Failed to save override');
    } else {
      setResults(prev => prev.map(r => r.id === overrideTarget.id
        ? { ...r, override_verdict: overrideForm.verdict || null, override_reason: overrideForm.reason || null }
        : r
      ));
      if (authProfile) await logActivity(authProfile.id, authProfile.full_name, {
        action: overrideForm.verdict ? 'overrode result verdict' : 'cleared result override',
        entity_type: 'result',
        entity_id: overrideTarget.id,
        details: { student: overrideTarget.student?.student_id, verdict: overrideForm.verdict, reason: overrideForm.reason },
      });
      toast.success(overrideForm.verdict ? 'Override saved' : 'Override cleared');
      setShowOverride(false);
      setOverrideTarget(null);
    }
    setSavingOverride(false);
  };

  const verdictBadge = (v: string) => {
    if (v === 'qualified') return <Badge variant="success">Qualified</Badge>;
    if (v === 'disqualified') return <Badge variant="danger">Disqualified</Badge>;
    return <Badge variant="warning">Not Qualified</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-border rounded animate-pulse" />
          <div className="h-8 w-48 bg-border rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="h-20 bg-border rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-12 bg-border rounded-xl animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-text-faint uppercase mb-1">Evaluation</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">Results</h1>
          <p className="text-sm text-text-muted mt-1">All finalized interview results across sessions</p>
        </div>
        {/* Export dropdown */}
        {filtered.length > 0 && (
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
            >
              <Download size={15} />
              {exporting ? 'Exporting...' : 'Export'}
              <ChevronDown size={14} />
            </Button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-border shadow-lg z-20 py-1.5">
                  <button
                    onClick={exportCsv}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface transition-colors"
                  >
                    <FileText size={15} className="text-text-muted" />
                    Export as CSV
                  </button>
                  <button
                    onClick={exportExcel}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface transition-colors"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    Export as Excel
                  </button>

                </div>
              </>
            )}
          </div>
        )}
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or student ID..."
            className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-evsu-maroon/20 focus:border-evsu-maroon"
          />
        </div>
        <Select
          value={verdictFilter}
          onChange={setVerdictFilter}
          options={[
            { value: '', label: 'All Verdicts' },
            { value: 'qualified', label: 'Qualified' },
            { value: 'not_qualified', label: 'Not Qualified' },
            { value: 'disqualified', label: 'Disqualified' },
          ]}
          className="w-44"
        />
        <Select
          value={sessionFilter}
          onChange={setSessionFilter}
          options={[
            { value: '', label: 'All Sessions' },
            ...sessions.map(s => ({ value: s.id, label: s.name })),
          ]}
          className="w-52"
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
                  className="text-left px-4 py-3 font-medium text-text-muted hover:text-text-primary"
                  onClick={() => toggleSort('last_name')}
                >
                  <span className="inline-flex items-center gap-1">
                    Student
                    {sortField === 'last_name' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">ID</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Program</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Session</th>
                <th
                  className="text-center px-4 py-3 font-medium text-text-muted hover:text-text-primary"
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
                <tr key={r.id} className="hover:bg-surface transition-colors group">
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">
                      {r.student?.last_name}, {r.student?.given_name}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{r.student?.student_id}</td>
                  <td className="px-4 py-3">
                    <Badge variant="maroon">{r.student?.program}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/sessions/${r.session_id}/results`}
                      className="text-evsu-maroon hover:underline text-xs font-medium"
                    >
                      {r.session?.name}
                    </Link>
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="font-mono font-bold">{r.avg_score?.toFixed(2)}</span>
                  </td>
                  <td className="text-center px-4 py-3 font-mono text-xs">{r.panel_count}</td>
                  <td className="text-center px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {verdictBadge(r.override_verdict ?? r.verdict)}
                      {r.override_verdict && (
                        <span title={r.override_reason ?? 'Override applied'}>
                          <Pencil size={11} className="text-orange-400 cursor-help" />
                        </span>
                      )}
                      <button
                        onClick={() => { setOverrideTarget(r); setOverrideForm({ verdict: r.override_verdict ?? '', reason: r.override_reason ?? '' }); setShowOverride(true); }}
                        className="p-0.5 rounded text-text-faint opacity-0 group-hover:opacity-100 hover:text-evsu-maroon transition-all cursor-pointer"
                        title="Override verdict"
                      >
                        <Pencil size={12} />
                      </button>
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
            <p className="text-xs mt-1">Results appear here after sessions are finalized.</p>
          </div>
        )}
      </Card>

      {/* Override Verdict Modal */}
      <Modal
        open={showOverride}
        onClose={() => { setShowOverride(false); setOverrideTarget(null); }}
        title="Override Verdict"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowOverride(false); setOverrideTarget(null); }}>Cancel</Button>
            <Button onClick={handleSaveOverride} loading={savingOverride}>
              {overrideForm.verdict ? 'Save Override' : 'Clear Override'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {overrideTarget && (
            <div className="bg-surface rounded-xl px-4 py-3 text-sm">
              <p className="font-semibold text-text-primary">
                {overrideTarget.student?.last_name}, {overrideTarget.student?.given_name}
              </p>
              <p className="text-text-muted text-xs mt-0.5">
                Calculated verdict: <span className="font-medium capitalize">{overrideTarget.verdict.replace('_', ' ')}</span>
                {' · '}Avg Score: <span className="font-mono font-medium">{overrideTarget.avg_score?.toFixed(2)}</span>
              </p>
            </div>
          )}
          <Select
            label="Override Verdict"
            value={overrideForm.verdict}
            onChange={v => setOverrideForm(f => ({ ...f, verdict: v }))}
            options={[
              { value: '', label: '— Use Calculated Verdict —' },
              { value: 'qualified', label: 'Qualified' },
              { value: 'not_qualified', label: 'Not Qualified' },
              { value: 'disqualified', label: 'Disqualified' },
            ]}
          />
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 tracking-wide uppercase">Reason / Notes</label>
            <textarea
              value={overrideForm.reason}
              onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Explain why this verdict is being overridden..."
              rows={3}
              className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-surface-card transition-all focus:outline-none focus:ring-2 focus:ring-evsu-maroon/15 focus:border-evsu-maroon resize-none"
            />
          </div>
          <p className="text-xs text-text-muted">
            Selecting &ldquo;Use Calculated Verdict&rdquo; removes any existing override.
          </p>
        </div>
      </Modal>
    </div>
  );
}
