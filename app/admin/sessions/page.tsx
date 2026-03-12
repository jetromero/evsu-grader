'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Session, Profile, Student } from '@/types';
import Card, { CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import { Plus, CalendarDays, Search, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { logActivity } from '@/lib/activity-log';

// ─── Module-level component (must NOT be inside AdminSessionsPage) ──────────
// Defining this inside the page component causes React to unmount/remount it
// on every state change, losing input focus.
interface FormState {
  name: string;
  interview_date: string;
  panelist_ids: string[];
  student_ids: string[];
}

interface SessionFormFieldsProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  panelists: Profile[];
  filteredStudents: Student[];
  studentSearch: string;
  setStudentSearch: (v: string) => void;
  togglePanelist: (id: string) => void;
  toggleStudent: (id: string) => void;
  selectAllFilteredStudents: () => void;
  deselectAllStudents: () => void;
}

function SessionFormFields({
  form, setForm, panelists, filteredStudents,
  studentSearch, setStudentSearch,
  togglePanelist, toggleStudent,
  selectAllFilteredStudents, deselectAllStudents,
}: SessionFormFieldsProps) {
  return (
    <div className="space-y-4">
      <Input
        label="Session Name"
        value={form.name}
        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
        placeholder="e.g. Latin Honors Interview – March 18, 2026"
      />
      <Input
        label="Interview Date"
        type="date"
        value={form.interview_date}
        onChange={e => setForm(prev => ({ ...prev, interview_date: e.target.value }))}
      />

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Assign Panelists
        </label>
        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
          {panelists.map(p => (
            <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-surface rounded p-1">
              <input
                type="checkbox"
                checked={form.panelist_ids.includes(p.id)}
                onChange={() => togglePanelist(p.id)}
                className="rounded border-gray-300 text-evsu-maroon focus:ring-evsu-maroon cursor-pointer"
              />
              <span>{p.full_name}</span>
              <span className="text-xs text-text-muted">{p.email}</span>
            </label>
          ))}
          {panelists.length === 0 && (
            <p className="text-xs text-text-muted text-center py-2">No panelists registered yet</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Assign Students{' '}
          {form.student_ids.length > 0 && (
            <span className="text-evsu-maroon">({form.student_ids.length} selected)</span>
          )}
        </label>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            placeholder="Search students by name, ID, or program..."
            className="w-full pl-8 pr-3 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-evsu-maroon/20 focus:border-evsu-maroon"
          />
        </div>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={selectAllFilteredStudents}
            className="text-xs text-evsu-maroon hover:underline cursor-pointer"
          >
            Select all shown
          </button>
          <span className="text-xs text-text-muted">|</span>
          <button
            type="button"
            onClick={deselectAllStudents}
            className="text-xs text-text-muted hover:underline cursor-pointer"
          >
            Clear all
          </button>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
          {filteredStudents.slice(0, 100).map(s => (
            <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-surface rounded p-1">
              <input
                type="checkbox"
                checked={form.student_ids.includes(s.id)}
                onChange={() => toggleStudent(s.id)}
                className="rounded border-gray-300 text-evsu-maroon focus:ring-evsu-maroon cursor-pointer"
              />
              <span className="font-medium">{s.last_name}, {s.given_name}</span>
              <span className="text-text-muted font-mono">{s.student_id}</span>
              <Badge variant="maroon" className="text-[10px] px-1.5 py-0">{s.program}</Badge>
            </label>
          ))}
          {filteredStudents.length > 100 && (
            <p className="text-xs text-text-muted text-center py-1">
              Showing first 100 of {filteredStudents.length}. Use search to narrow down.
            </p>
          )}
          {filteredStudents.length === 0 && (
            <p className="text-xs text-text-muted text-center py-2">No students found</p>
          )}
        </div>
      </div>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

export default function AdminSessionsPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [panelists, setPanelists] = useState<Profile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit state
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    interview_date: '',
    panelist_ids: [] as string[],
    student_ids: [] as string[],
  });

  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [sessionsRes, panelistsRes, studentsRes] = await Promise.all([
      supabase.from('sessions').select('*').order('interview_date', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'panelist'),
      supabase.from('students').select('*').order('last_name'),
    ]);
    setSessions(sessionsRes.data ?? []);
    setPanelists(panelistsRes.data ?? []);
    setStudents(studentsRes.data ?? []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: '', interview_date: '', panelist_ids: [], student_ids: [] });
    setStudentSearch('');
  };

  const handleCreate = async () => {
    if (!profile) return;
    setCreating(true);

    const selectedStudents = students.filter(s => form.student_ids.includes(s.id));
    const programs = [...new Set(selectedStudents.map(s => s.program))];
    const program = programs.length === 1 ? programs[0] : programs.length > 0 ? 'MIXED' : 'N/A';

    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        name: form.name,
        program,
        interview_date: form.interview_date,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error || !newSession) {
      toast.error('Failed to create session');
      setCreating(false);
      return;
    }

    if (form.panelist_ids.length > 0) {
      await supabase.from('session_panelists').insert(
        form.panelist_ids.map(pid => ({
          session_id: newSession.id,
          panelist_id: pid,
        }))
      );
    }

    if (form.student_ids.length > 0) {
      await supabase.from('session_students').insert(
        form.student_ids.map(sid => ({
          session_id: newSession.id,
          student_id: sid,
        }))
      );
    }

    await logActivity(profile.id, profile.full_name, {
      action: 'created session',
      entity_type: 'session',
      entity_id: newSession.id,
      details: { name: form.name, date: form.interview_date, panelists: form.panelist_ids.length, students: form.student_ids.length },
    });

    toast.success('Session created successfully');
    setShowCreate(false);
    resetForm();
    setCreating(false);
    fetchData();
  };

  const openEdit = async (session: Session) => {
    setEditSession(session);
    setEditLoading(true);
    setShowEdit(true);

    // Load existing assigned panelists and students for this session
    const [panelistsRes, studentsRes] = await Promise.all([
      supabase.from('session_panelists').select('panelist_id').eq('session_id', session.id),
      supabase.from('session_students').select('student_id').eq('session_id', session.id),
    ]);

    setForm({
      name: session.name,
      interview_date: session.interview_date,
      panelist_ids: (panelistsRes.data ?? []).map((p: { panelist_id: string }) => p.panelist_id),
      student_ids: (studentsRes.data ?? []).map((s: { student_id: string }) => s.student_id),
    });
    setStudentSearch('');
    setEditLoading(false);
  };

  const handleEdit = async () => {
    if (!editSession) return;
    setSaving(true);

    const selectedStudents = students.filter(s => form.student_ids.includes(s.id));
    const programs = [...new Set(selectedStudents.map(s => s.program))];
    const program = programs.length === 1 ? programs[0] : programs.length > 0 ? 'MIXED' : 'N/A';

    const { error } = await supabase
      .from('sessions')
      .update({
        name: form.name,
        program,
        interview_date: form.interview_date,
      })
      .eq('id', editSession.id);

    if (error) {
      toast.error('Failed to update session');
      setSaving(false);
      return;
    }

    // Sync panelists: remove old, insert new
    await supabase.from('session_panelists').delete().eq('session_id', editSession.id);
    if (form.panelist_ids.length > 0) {
      await supabase.from('session_panelists').insert(
        form.panelist_ids.map(pid => ({
          session_id: editSession.id,
          panelist_id: pid,
        }))
      );
    }

    // Sync students: remove old, insert new
    await supabase.from('session_students').delete().eq('session_id', editSession.id);
    if (form.student_ids.length > 0) {
      await supabase.from('session_students').insert(
        form.student_ids.map(sid => ({
          session_id: editSession.id,
          student_id: sid,
        }))
      );
    }

    await logActivity(profile!.id, profile!.full_name, {
      action: 'updated session',
      entity_type: 'session',
      entity_id: editSession.id,
      details: { name: form.name, date: form.interview_date, panelists: form.panelist_ids.length, students: form.student_ids.length },
    });

    toast.success('Session updated successfully');
    setShowEdit(false);
    setEditSession(null);
    resetForm();
    setSaving(false);
    fetchData();
  };

  const togglePanelist = (id: string) => {
    setForm(prev => ({
      ...prev,
      panelist_ids: prev.panelist_ids.includes(id)
        ? prev.panelist_ids.filter(p => p !== id)
        : [...prev.panelist_ids, id],
    }));
  };

  const toggleStudent = (id: string) => {
    setForm(prev => ({
      ...prev,
      student_ids: prev.student_ids.includes(id)
        ? prev.student_ids.filter(s => s !== id)
        : [...prev.student_ids, id],
    }));
  };

  const selectAllFilteredStudents = () => {
    const ids = filteredStudents.map(s => s.id);
    setForm(prev => ({
      ...prev,
      student_ids: [...new Set([...prev.student_ids, ...ids])],
    }));
  };

  const deselectAllStudents = () => {
    setForm(prev => ({ ...prev, student_ids: [] }));
  };

  const filteredStudents = students.filter(s => {
    const q = studentSearch.toLowerCase();
    return !studentSearch || s.last_name.toLowerCase().includes(q) ||
      s.given_name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) ||
      s.program.toLowerCase().includes(q);
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const sessionToDelete = sessions.find(s => s.id === deleteId);
    const idToDelete = deleteId;

    // Optimistic update — remove immediately
    setSessions(prev => prev.filter(s => s.id !== idToDelete));
    setDeleteId(null);
    setDeleting(false);

    const { error } = await supabase.from('sessions').delete().eq('id', idToDelete);
    if (error) {
      toast.error('Failed to delete session');
      fetchData(); // rollback
    } else {
      await logActivity(profile!.id, profile!.full_name, {
        action: 'deleted session',
        entity_type: 'session',
        entity_id: idToDelete,
        details: { name: sessionToDelete?.name },
      });
      toast.success('Session deleted');
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'open') return <Badge variant="success">Open</Badge>;
    if (status === 'closed') return <Badge variant="warning">Closed</Badge>;
    return <Badge variant="info">Finalized</Badge>;
  };

  const formFieldProps: SessionFormFieldsProps = {
    form, setForm, panelists, filteredStudents,
    studentSearch, setStudentSearch,
    togglePanelist, toggleStudent,
    selectAllFilteredStudents, deselectAllStudents,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="h-3 w-24 bg-border rounded animate-pulse mb-2" />
            <div className="h-8 w-48 bg-border rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent>
                <div className="space-y-3">
                  <div className="h-5 w-40 bg-border rounded" />
                  <div className="h-4 w-28 bg-border rounded" />
                  <div className="h-5 w-16 bg-border rounded" />
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
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">Sessions</h1>
          <p className="text-sm text-text-muted mt-1">{sessions.length} interview sessions</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }} className="flex-shrink-0">
          <Plus size={15} /> Create Session
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map(s => (
          <div key={s.id} className="relative group">
            <Link href={`/admin/sessions/${s.id}/results`}>
              <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                <CardContent>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-text-primary">{s.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-text-muted">
                        <CalendarDays size={14} />
                        {s.interview_date}
                      </div>
                    </div>
                    {statusBadge(s.status)}
                  </div>
                  <Badge variant="maroon">{s.program}</Badge>
                </CardContent>
              </Card>
            </Link>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.preventDefault(); openEdit(s); }}
                className="p-1.5 rounded-lg bg-white/80 border border-border text-evsu-maroon hover:bg-evsu-maroon/5 cursor-pointer shadow-sm"
                title="Edit session"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); setDeleteId(s.id); }}
                className="p-1.5 rounded-lg bg-white/80 border border-border text-red-500 hover:bg-red-50 cursor-pointer shadow-sm"
                title="Delete session"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <CalendarDays size={48} className="mx-auto mb-3 opacity-30" />
          <p>No sessions created yet.</p>
        </div>
      )}

      {/* Create Session Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Interview Session"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} disabled={!form.name || !form.interview_date}>
              Create Session
            </Button>
          </>
        }
      >
        <SessionFormFields {...formFieldProps} />
      </Modal>

      {/* Edit Session Modal */}
      <Modal
        open={showEdit}
        onClose={() => { setShowEdit(false); setEditSession(null); resetForm(); }}
        title="Edit Session"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowEdit(false); setEditSession(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleEdit} loading={saving} disabled={!form.name || !form.interview_date}>
              Save Changes
            </Button>
          </>
        }
      >
        {editLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-evsu-maroon border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <SessionFormFields {...formFieldProps} />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Session"
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      >
        <p className="text-sm text-text-muted">
          Are you sure you want to delete this session? This will also remove all associated grades, panelist assignments, and student assignments. This action cannot be undone.
        </p>
      </ConfirmModal>
    </div>
  );
}
