'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Card, { CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import { Plus, BookOpen, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { logActivity } from '@/lib/activity-log';

interface RegisteredProgram {
  id: string;
  abbreviation: string;
  name: string;
  created_at: string;
}

export default function AdminProgramsPage() {
  const { profile: authProfile } = useAuth();
  const supabase = createClient();

  const [programs, setPrograms] = useState<RegisteredProgram[]>([]);
  const [loading, setLoading] = useState(true);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({ abbreviation: '', name: '' });

  // Edit
  const [editTarget, setEditTarget] = useState<RegisteredProgram | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ abbreviation: '', name: '' });
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data } = await supabase
      .from('programs')
      .select('*')
      .order('abbreviation');
    setPrograms(data ?? []);
    setLoading(false);
  };

  // ── Create ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const abbr = form.abbreviation.trim().toUpperCase();
      const name = form.name.trim().toUpperCase();
      if (!abbr || !name) { setCreateError('Both fields are required.'); setCreating(false); return; }

      // Optimistic: close modal immediately, add temp entry
      const tempId = `temp-${abbr}`;
      setPrograms(prev => {
        const next = prev.filter(p => p.abbreviation.toUpperCase() !== abbr);
        next.push({ id: tempId, abbreviation: abbr, name, created_at: new Date().toISOString() });
        return next.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
      });
      setShowCreate(false);
      setForm({ abbreviation: '', name: '' });
      setCreating(false); // reset so button is fresh on next open

      const { data, error } = await supabase
        .from('programs')
        .insert({ abbreviation: abbr, name })
        .select()
        .single();

      if (error) {
        setPrograms(prev => prev.filter(p => p.id !== tempId)); // rollback
        toast.error(
          error.code === '23505'
            ? `Program "${abbr}" already exists.`
            : 'Failed to register program'
        );
        return;
      }

      // Replace temp with real entry
      setPrograms(prev => prev.map(p => p.id === tempId ? data : p));

      if (authProfile) await logActivity(authProfile.id, authProfile.full_name, {
        action: 'created program',
        entity_type: 'program',
        entity_id: data.id,
        details: { abbreviation: abbr, name },
      });
      toast.success(`Program "${abbr}" registered`);
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (prog: RegisteredProgram) => {
    setEditTarget(prog);
    setEditForm({ abbreviation: prog.abbreviation, name: prog.name });
    setEditError('');
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    setEditError('');
    try {
      const abbr = editForm.abbreviation.trim().toUpperCase();
      const name = editForm.name.trim().toUpperCase();
      if (!abbr || !name) { setEditError('Both fields are required.'); setSaving(false); return; }

      // Optimistic update
      setPrograms(prev =>
        prev.map(p =>
          p.id === editTarget.id ? { ...p, abbreviation: abbr, name } : p
        ).sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))
      );
      setShowEdit(false);
      setEditTarget(null);

      const { error } = await supabase
        .from('programs')
        .update({ abbreviation: abbr, name })
        .eq('id', editTarget.id);

      if (error) {
        toast.error(
          error.code === '23505'
            ? `Abbreviation "${abbr}" is already used by another program.`
            : 'Failed to update program'
        );
        fetchData(); // rollback
        return;
      }

      if (authProfile) await logActivity(authProfile.id, authProfile.full_name, {
        action: 'updated program',
        entity_type: 'program',
        entity_id: editTarget.id,
        details: { abbreviation: abbr, name },
      });
      toast.success('Program updated');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    const progToDelete = programs.find(p => p.id === deleteId);

    // Optimistic
    setPrograms(prev => prev.filter(p => p.id !== deleteId));
    setDeleteId(null);
    setDeleting(false);

    const { error } = await supabase.from('programs').delete().eq('id', deleteId);
    if (error) {
      toast.error('Failed to delete program');
      fetchData(); // rollback
    } else {
      if (authProfile) await logActivity(authProfile.id, authProfile.full_name, {
        action: 'deleted program',
        entity_type: 'program',
        entity_id: deleteId,
        details: { abbreviation: progToDelete?.abbreviation },
      });
      toast.success('Program removed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-heading">Programs</h1>
            <p className="text-sm text-text-muted">Loading programs...</p>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-6 bg-border rounded" />
                  <div className="h-4 w-64 bg-border rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-text-faint uppercase mb-1">Management</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">Programs</h1>
          <p className="text-sm text-text-muted mt-1">{programs.length} registered programs</p>
        </div>
        <Button onClick={() => { setCreating(false); setShowCreate(true); }} className="flex-shrink-0">
          <Plus size={15} /> Add Program
        </Button>
      </div>

      {/* Summary Stat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 bg-evsu-maroon/10 rounded-xl flex items-center justify-center">
              <BookOpen size={20} className="text-evsu-maroon" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono">{programs.length}</p>
              <p className="text-xs text-text-muted">Total Programs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <BookOpen size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono">{programs.length}</p>
              <p className="text-xs text-text-muted">Registered</p>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Program List */}
      <div className="space-y-3">
        {programs.map(prog => (
          <Card
            key={prog.id}
            className="hover:-translate-y-0.5 hover:shadow-md transition-all group"
          >
            <CardContent>
              <div className="flex items-center gap-4">
                <Badge variant="maroon">{prog.abbreviation}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-medium">{prog.name}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(prog)}
                    className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-evsu-maroon transition-all cursor-pointer"
                    title="Edit program"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteId(prog.id)}
                    className="p-2 rounded-lg text-text-muted hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
                    title="Remove program"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {programs.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p>No programs yet. Click &quot;Add Program&quot; to get started.</p>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setForm({ abbreviation: '', name: '' }); setCreateError(''); }}
        title="Register Program"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowCreate(false); setForm({ abbreviation: '', name: '' }); setCreateError(''); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!form.abbreviation || !form.name}>
              Register
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Abbreviation"
            value={form.abbreviation}
            onChange={e => setForm({ ...form, abbreviation: e.target.value.toUpperCase() })}
            placeholder="e.g. BSIT"
          />
          <Input
            label="Full Program Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })}
            placeholder="E.G. BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY"
          />
          {createError && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {createError}
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEdit}
        onClose={() => { setShowEdit(false); setEditTarget(null); setEditError(''); }}
        title="Edit Program"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowEdit(false); setEditTarget(null); setEditError(''); }}>
              Cancel
            </Button>
            <Button onClick={handleEdit} loading={saving} disabled={!editForm.abbreviation || !editForm.name}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Abbreviation"
            value={editForm.abbreviation}
            onChange={e => setEditForm({ ...editForm, abbreviation: e.target.value.toUpperCase() })}
            placeholder="e.g. BSIT"
          />
          <Input
            label="Full Program Name"
            value={editForm.name}
            onChange={e => setEditForm({ ...editForm, name: e.target.value.toUpperCase() })}
            placeholder="E.G. BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY"
          />
          {editError && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {editError}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remove Program"
        confirmText="Remove"
        variant="danger"
        loading={deleting}
      >
        <p className="text-sm text-text-muted">
          Remove this program registration? Students already assigned to this program will not be affected.
        </p>
      </ConfirmModal>
    </div>
  );
}