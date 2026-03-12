'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Profile } from '@/types';
import Card, { CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import { Plus, Users, Mail, ClipboardList, Trash2, Shield, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { logActivity } from '@/lib/activity-log';

export default function AdminPanelistsPage() {
  const { profile: authProfile } = useAuth();
  const supabase = createClient();

  const [panelists, setPanelists] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [programOptions, setProgramOptions] = useState<{ value: string; label: string }[]>([]);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'panelist' as 'panelist' | 'program_head',
    program: '',
  });

  // Activity tracking
  const [activity, setActivity] = useState<Record<string, number>>({});
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['panelist', 'program_head'])
      .order('full_name');

    setPanelists(data ?? []);

    // Fetch programs for dropdown
    const { data: progsData } = await supabase
      .from('programs')
      .select('abbreviation, name')
      .order('abbreviation');
    setProgramOptions((progsData ?? []).map((p: { abbreviation: string; name: string }) => ({ value: p.abbreviation, label: `${p.abbreviation} – ${p.name}` })));

    // Batch-fetch all grades and session assignments in 2 queries instead of 2N
    const [gradesRes, sessRes] = await Promise.all([
      supabase.from('grades').select('panelist_id'),
      supabase.from('session_panelists').select('panelist_id'),
    ]);

    const gradeCounts: Record<string, number> = {};
    const sessCounts: Record<string, number> = {};
    for (const row of (gradesRes.data ?? [])) {
      gradeCounts[row.panelist_id] = (gradeCounts[row.panelist_id] ?? 0) + 1;
    }
    for (const row of (sessRes.data ?? [])) {
      sessCounts[row.panelist_id] = (sessCounts[row.panelist_id] ?? 0) + 1;
    }
    setActivity(gradeCounts);
    setSessionCounts(sessCounts);
    setLoading(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');

    try {
      const res = await fetch('/api/panelists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          role: form.role,
          program: form.role === 'program_head' ? form.program : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || 'Failed to create account');
        setCreating(false);
        return;
      }

      // Optimistically add the new account to state — no need to refetch everything
      const newPanelist: Profile = {
        id: data.user.id,
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        program: form.role === 'program_head' ? form.program : null,
        created_at: new Date().toISOString(),
      };
      setPanelists(prev => [...prev, newPanelist].sort((a, b) => a.full_name.localeCompare(b.full_name)));

      // Fire logActivity in the background — don't block UI on it
      if (authProfile) logActivity(authProfile.id, authProfile.full_name, {
        action: form.role === 'program_head' ? 'created program head' : 'created panelist',
        entity_type: 'panelist',
        details: { name: form.full_name, email: form.email, role: form.role, program: form.program || undefined },
      }).catch(console.error);

      toast.success(`${form.role === 'program_head' ? 'Program Head' : 'Panelist'} account created successfully`);
      setShowCreate(false);
      setForm({ full_name: '', email: '', password: '', role: 'panelist', program: '' });
      setCreating(false);
    } catch {
      setCreateError('Network error. Please try again.');
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const panelistToDelete = panelists.find(p => p.id === deleteId);

    // Optimistic update — remove immediately so UI is instant
    setPanelists(prev => prev.filter(p => p.id !== deleteId));
    setActivity(prev => { const n = { ...prev }; delete n[deleteId]; return n; });
    setSessionCounts(prev => { const n = { ...prev }; delete n[deleteId]; return n; });
    setDeleteId(null);
    setDeleting(false);

    // Use DELETE API so auth.users is also removed (prevents "already registered" ghost)
    const res = await fetch('/api/panelists', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteId }),
    });

    if (!res.ok) {
      toast.error('Failed to remove account');
      fetchData(); // rollback on error
    } else {
      if (authProfile) await logActivity(authProfile.id, authProfile.full_name, {
        action: 'deleted panelist',
        entity_type: 'panelist',
        entity_id: deleteId,
        details: { name: panelistToDelete?.full_name, email: panelistToDelete?.email },
      });
      toast.success('Account removed');
    }
  };

  const totalGrades = Object.values(activity).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-heading">Accounts</h1>
            <p className="text-sm text-text-muted">Loading accounts...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="flex items-center gap-3">
                <div className="w-10 h-10 bg-border rounded-xl" />
                <div className="space-y-1.5">
                  <div className="h-6 w-10 bg-border rounded" />
                  <div className="h-3 w-28 bg-border rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-border rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-border rounded" />
                    <div className="h-3 w-52 bg-border rounded" />
                  </div>
                  <div className="h-5 w-20 bg-border rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const panelistOnly = panelists.filter(p => p.role === 'panelist');
  const programHeads = panelists.filter(p => p.role === 'program_head');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-text-faint uppercase mb-1">Management</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">Accounts</h1>
          <p className="text-sm text-text-muted mt-1">{panelists.length} registered accounts</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex-shrink-0">
          <Plus size={15} /> Create Account
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 bg-evsu-maroon/10 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-evsu-maroon" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono">{panelists.length}</p>
              <p className="text-xs text-text-muted">Total Accounts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <ClipboardList size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono">{totalGrades}</p>
              <p className="text-xs text-text-muted">Total Grades Submitted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 bg-evsu-maroon/10 rounded-xl flex items-center justify-center">
              <Award size={20} className="text-evsu-maroon/60" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono">
                {panelistOnly.length > 0 ? Math.round(totalGrades / panelistOnly.length) : 0}
              </p>
              <p className="text-xs text-text-muted">Avg. Grades per Panelist</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Panelists Section ─────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-widest flex items-center gap-2">
          <Shield size={14} /> Panelists
          <span className="ml-1 text-text-faint font-normal normal-case tracking-normal">{panelistOnly.length}</span>
        </h2>
        {panelistOnly.length === 0 ? (
          <p className="text-sm text-text-muted px-1">No panelists yet.</p>
        ) : panelistOnly.map(p => {
          const gradeCount = activity[p.id] ?? 0;
          const sessCount = sessionCounts[p.id] ?? 0;
          return (
            <Card key={p.id} className="hover:-translate-y-0.5 hover:shadow-md transition-all group">
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-gradient-to-br from-evsu-maroon to-evsu-maroon/70 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                    {p.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-text-primary text-sm">{p.full_name}</h3>
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                      <Mail size={11} />
                      <span className="truncate">{p.email}</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-center">
                    <div>
                      <p className="text-sm font-bold font-mono">{sessCount}</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Sessions</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold font-mono">{gradeCount}</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Grades</p>
                    </div>
                  </div>
                  <div className="flex sm:hidden items-center gap-2">
                    <Badge variant="gold">{sessCount} sessions</Badge>
                    <Badge variant="info">{gradeCount} grades</Badge>
                  </div>
                  <button
                    onClick={() => setDeleteId(p.id)}
                    className="p-2 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
                    title="Remove account"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Program Heads Section ─────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-widest flex items-center gap-2">
          <Award size={14} /> Program Heads
          <span className="ml-1 text-text-faint font-normal normal-case tracking-normal">{programHeads.length}</span>
        </h2>
        {programHeads.length === 0 ? (
          <p className="text-sm text-text-muted px-1">No program heads yet.</p>
        ) : programHeads.map(p => (
          <Card key={p.id} className="hover:-translate-y-0.5 hover:shadow-md transition-all group">
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                  {p.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary text-sm">{p.full_name}</h3>
                    {p.program && <Badge variant="maroon">{p.program}</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                    <Mail size={11} />
                    <span className="truncate">{p.email}</span>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteId(p.id)}
                  className="p-2 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
                  title="Remove account"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {panelists.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>No accounts registered yet.</p>
        </div>
      )}

      {/* Create Account Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Account"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              loading={creating}
              disabled={
                !form.full_name || !form.email || !form.password ||
                (form.role === 'program_head' && !form.program)
              }
            >
              Create {form.role === 'program_head' ? 'Program Head' : 'Panelist'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Role"
            value={form.role}
            onChange={v => setForm({ ...form, role: v as 'panelist' | 'program_head', program: '' })}
            options={[
              { value: 'panelist', label: 'Panelist' },
              { value: 'program_head', label: 'Program Head' },
            ]}
          />
          <Input
            label="Full Name"
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value.toUpperCase() })}
            placeholder="e.g. PROF. JUAN DELA CRUZ"
          />
          <Input
            label="Email Address"
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="e.g. juan@evsu.edu.ph"
          />
          <Input
            label="Temporary Password"
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="Min 6 characters"
          />
          {form.role === 'program_head' && (
            <Select
              searchable
              label="Program"
              value={form.program}
              onChange={v => setForm({ ...form, program: v })}
              options={programOptions}
              placeholder="Select or search program..."
            />
          )}
          {createError && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {createError}
            </div>
          )}
          <p className="text-xs text-text-muted">
            {form.role === 'program_head'
              ? 'This account can view results for their assigned program only.'
              : 'The panelist can change their password after first login.'}
          </p>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remove Account"
        confirmText="Remove"
        variant="danger"
        loading={deleting}
      >
        <p className="text-sm text-text-muted">
          Are you sure you want to remove this account? Their submitted grades will be preserved but they will lose access to the system.
        </p>
      </ConfirmModal>
    </div>
  );
}
