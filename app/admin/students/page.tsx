'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Student } from '@/types';
import { parseStudentCSV, ParsedStudent } from '@/lib/csvParser';
import Card, { CardContent, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import { Upload, Search, Plus, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { logActivity } from '@/lib/activity-log';

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3 text-right"><div className="h-4 w-12 bg-gray-200 rounded ml-auto" /></td>
    </tr>
  );
}

export default function AdminStudentsPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');

  // CSV upload state
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [csvStudents, setCsvStudents] = useState<ParsedStudent[]>([]);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: number; errors: number; skipped: number } | null>(null);

  // Add student modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    student_id: '', last_name: '', given_name: '', middle_name: '',
    gender: 'M', program: '', interview_date: ''
  });
  const [addLoading, setAddLoading] = useState(false);

  // Edit student modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('last_name', { ascending: true });
    setStudents(data ?? []);
    setLoading(false);
  };

  const programs = [...new Set(students.map(s => s.program))].sort();

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !search || s.last_name.toLowerCase().includes(q) ||
      s.given_name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q);
    const matchProgram = !programFilter || s.program === programFilter;
    return matchSearch && matchProgram;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [search, programFilter]);

  // CSV Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseStudentCSV(text);
      setCsvStudents(parsed);
      setShowCsvPreview(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCsvImport = async () => {
    setCsvUploading(true);
    let success = 0;
    let skipped = 0;
    let errors = 0;

    // Filter out students that already exist
    const existingIds = new Set(students.map(s => s.student_id));
    const newStudents = csvStudents.filter(s => {
      if (existingIds.has(s.student_id)) {
        skipped++;
        return false;
      }
      return true;
    });

    // Batch insert in chunks of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < newStudents.length; i += BATCH_SIZE) {
      const batch = newStudents.slice(i, i + BATCH_SIZE).map(s => ({
        student_id: s.student_id.toUpperCase(),
        last_name: s.last_name.toUpperCase(),
        given_name: s.given_name.toUpperCase(),
        middle_name: s.middle_name ? s.middle_name.toUpperCase() : null,
        gender: s.gender ? s.gender.toUpperCase() : null,
        program: s.program.toUpperCase(),
        interview_date: s.interview_date || null,
      }));

      const { data, error } = await supabase
        .from('students')
        .insert(batch)
        .select();

      if (error) {
        errors += batch.length;
      } else {
        success += data?.length ?? batch.length;
      }
    }

    setCsvResult({ success, errors, skipped });
    setCsvUploading(false);
    if (success > 0) {
      toast.success(`${success} students imported successfully`);
      if (profile) await logActivity(profile.id, profile.full_name, {
        action: 'imported students via CSV',
        entity_type: 'student',
        details: { imported: success, skipped, errors },
      });
    }
    if (skipped > 0) toast(`${skipped} duplicates skipped`, { icon: '⚠️' });
    if (errors > 0) toast.error(`${errors} failed to import`);
    fetchStudents();
  };

  // Add Student
  const handleAddStudent = async () => {
    setAddLoading(true);
    if (!/^[\d-]+$/.test(addForm.student_id) || !addForm.student_id.trim()) {
      toast.error('Student ID must contain numbers and hyphens only (e.g. 2022-30166)');
      setAddLoading(false);
      return;
    }
    const exists = students.some(s => s.student_id === addForm.student_id.toUpperCase());
    if (exists) {
      toast.error('A student with ID ' + addForm.student_id + ' already exists.');
      setAddLoading(false);
      return;
    }
    const { error } = await supabase.from('students').insert({
      student_id: addForm.student_id.toUpperCase(),
      last_name: addForm.last_name.toUpperCase(),
      given_name: addForm.given_name.toUpperCase(),
      middle_name: addForm.middle_name ? addForm.middle_name.toUpperCase() : null,
      gender: addForm.gender || null,
      program: addForm.program.toUpperCase(),
      interview_date: addForm.interview_date || null,
    });
    if (error) {
      toast.error('Failed to add student: ' + error.message);
      setAddLoading(false);
      return;
    }
    if (profile) await logActivity(profile.id, profile.full_name, {
      action: 'created student',
      entity_type: 'student',
      details: { student_id: addForm.student_id, name: `${addForm.last_name}, ${addForm.given_name}` },
    });
    toast.success('Student added successfully');
    setShowAddModal(false);
    setAddForm({ student_id: '', last_name: '', given_name: '', middle_name: '', gender: 'M', program: '', interview_date: '' });
    setAddLoading(false);
    fetchStudents();
  };

  // Edit Student
  const startEdit = (s: Student) => {
    setEditForm({ ...s });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setEditLoading(true);
    const { error } = await supabase.from('students').update({
      student_id: editForm.student_id.toUpperCase(),
      last_name: editForm.last_name.toUpperCase(),
      given_name: editForm.given_name.toUpperCase(),
      middle_name: editForm.middle_name ? editForm.middle_name.toUpperCase() : null,
      gender: editForm.gender || null,
      program: editForm.program.toUpperCase(),
      interview_date: editForm.interview_date || null,
    }).eq('id', editForm.id);
    if (error) {
      toast.error('Failed to save: ' + error.message);
      setEditLoading(false);
      return;
    }
    if (profile) await logActivity(profile.id, profile.full_name, {
      action: 'updated student',
      entity_type: 'student',
      entity_id: editForm.id,
      details: { student_id: editForm.student_id, name: `${editForm.last_name}, ${editForm.given_name}` },
    });
    toast.success('Student updated successfully');
    setShowEditModal(false);
    setEditForm(null);
    setEditLoading(false);
    fetchStudents();
  };

  // Delete Student
  const confirmDelete = (s: Student) => {
    setDeleteTarget(s);
    setShowDeleteConfirm(true);
  };

  const deleteStudent = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;

    // Optimistic update — remove immediately
    setStudents(prev => prev.filter(s => s.id !== target.id));
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
    setDeleteLoading(false);

    const { error } = await supabase.from('students').delete().eq('id', target.id);
    if (error) {
      toast.error('Failed to delete student');
      fetchStudents(); // rollback
    } else {
      if (profile) await logActivity(profile.id, profile.full_name, {
        action: 'deleted student',
        entity_type: 'student',
        entity_id: target.id,
        details: { student_id: target.student_id, name: `${target.last_name}, ${target.given_name}` },
      });
      toast.success('Student deleted');
    }
  };

  if (loading) {
    // We still show the page skeleton below, so no early return needed
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-text-faint uppercase mb-1">Management</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">Students</h1>
          <p className="text-sm text-text-muted mt-1">{students.length} students in the system</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Upload CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus size={15} /> Add Student
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or student ID..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-evsu-maroon/20 focus:border-evsu-maroon"
          />
        </div>
        <Select
          value={programFilter}
          onChange={setProgramFilter}
          options={[
            { value: '', label: 'All Programs' },
            ...programs.map(p => ({ value: p, label: p })),
          ]}
          className="w-44"
        />
      </div>

      {/* Students Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Student ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Last Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Given Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Middle Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Gender</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Program</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Date Added</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : (
                paginated.map(s => (
                  <tr key={s.id} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{s.student_id}</td>
                    <td className="px-4 py-3 font-medium">{s.last_name}</td>
                    <td className="px-4 py-3">{s.given_name}</td>
                    <td className="px-4 py-3 text-text-muted">{s.middle_name || '—'}</td>
                    <td className="px-4 py-3 text-text-muted">{s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : '—'}</td>
                    <td className="px-4 py-3"><Badge variant="maroon">{s.program}</Badge></td>
                    <td className="px-4 py-3 text-text-muted text-xs">{s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(s)} className="text-text-muted hover:text-evsu-maroon mr-2 cursor-pointer">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => confirmDelete(s)} className="text-text-muted hover:text-red-600 cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted">No students found.</div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-text-muted">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              className={`px-3 py-1 text-xs rounded-lg border border-border hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}
              >Prev</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) p = i + 1;
                else if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1 text-xs rounded-lg border cursor-pointer ${p === page ? 'bg-evsu-maroon text-white border-evsu-maroon' : 'border-border hover:bg-surface-alt'}`}
                  >{p}</button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              className={`px-3 py-1 text-xs rounded-lg border border-border hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}
              >Next</button>
            </div>
          </div>
        )}
      </Card>

      {/* CSV Preview Modal */}
      <Modal
        open={showCsvPreview}
        onClose={() => { setShowCsvPreview(false); setCsvResult(null); }}
        title="CSV Import Preview"
        footer={
          csvResult ? (
            <Button onClick={() => { setShowCsvPreview(false); setCsvResult(null); }}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setShowCsvPreview(false)}>Cancel</Button>
              <Button onClick={handleCsvImport} loading={csvUploading}
                disabled={csvStudents.filter(s => !students.some(e => e.student_id === s.student_id)).length === 0}>
                Import {csvStudents.filter(s => !students.some(e => e.student_id === s.student_id)).length} New Students
              </Button>
            </>
          )
        }
      >
        {csvResult ? (
          <div className="text-center py-4">
            <CheckCircleIcon className="mx-auto mb-3 text-green-600" size={40} />
            <p className="text-lg font-semibold">{csvResult.success} imported successfully</p>
            {csvResult.skipped > 0 && (
              <p className="text-sm text-amber-600">{csvResult.skipped} skipped (already exist)</p>
            )}
            {csvResult.errors > 0 && (
              <p className="text-sm text-red-600">{csvResult.errors} errors</p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-text-muted mb-3">
              Found {csvStudents.length} students in CSV.
              {(() => {
                const dupes = csvStudents.filter(s => students.some(e => e.student_id === s.student_id)).length;
                if (dupes > 0) return <> <span className="text-amber-600 font-medium">{dupes} already exist</span> and will be skipped.</>;
                return ' Review below:';
              })()}
            </p>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-surface-alt sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Student ID</th>
                    <th className="px-2 py-1 text-left">Last Name</th>
                    <th className="px-2 py-1 text-left">Given Name</th>
                    <th className="px-2 py-1 text-left">Middle Name</th>
                    <th className="px-2 py-1 text-left">Gender</th>
                    <th className="px-2 py-1 text-left">Program</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {csvStudents.slice(0, 50).map((s, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 font-mono">{s.student_id}</td>
                      <td className="px-2 py-1">{s.last_name}</td>
                      <td className="px-2 py-1">{s.given_name}</td>
                      <td className="px-2 py-1">{s.middle_name || '—'}</td>
                      <td className="px-2 py-1">{s.gender || '—'}</td>
                      <td className="px-2 py-1">{s.program}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvStudents.length > 50 && (
                <p className="text-center py-2 text-xs text-text-muted">
                  ...and {csvStudents.length - 50} more
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Student Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Student"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddStudent} loading={addLoading}>Add Student</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Student ID" value={addForm.student_id}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9-]/g, '');
              setAddForm({ ...addForm, student_id: val });
            }} placeholder="e.g. 2022-30166" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Last Name" value={addForm.last_name}
              onChange={e => setAddForm({ ...addForm, last_name: e.target.value.toUpperCase() })} />
            <Input label="Given Name" value={addForm.given_name}
              onChange={e => setAddForm({ ...addForm, given_name: e.target.value.toUpperCase() })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Middle Name" value={addForm.middle_name}
              onChange={e => setAddForm({ ...addForm, middle_name: e.target.value.toUpperCase() })} />
            <Select
              label="Gender"
              value={addForm.gender}
              onChange={v => setAddForm({ ...addForm, gender: v })}
              options={[
                { value: 'M', label: 'Male' },
                { value: 'F', label: 'Female' },
              ]}
            />
          </div>
          <Input label="Program" value={addForm.program}
            onChange={e => setAddForm({ ...addForm, program: e.target.value.toUpperCase() })} placeholder="e.g. BSIT" />
        </div>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setEditForm(null); }}
        title="Edit Student"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowEditModal(false); setEditForm(null); }}>Cancel</Button>
            <Button onClick={saveEdit} loading={editLoading}>Save Changes</Button>
          </>
        }
      >
        {editForm && (
          <div className="space-y-3">
            <Input label="Student ID" value={editForm.student_id}
              onChange={e => setEditForm({ ...editForm, student_id: e.target.value.toUpperCase() })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Last Name" value={editForm.last_name}
                onChange={e => setEditForm({ ...editForm, last_name: e.target.value.toUpperCase() })} />
              <Input label="Given Name" value={editForm.given_name}
                onChange={e => setEditForm({ ...editForm, given_name: e.target.value.toUpperCase() })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Middle Name" value={editForm.middle_name || ''}
                onChange={e => setEditForm({ ...editForm, middle_name: e.target.value.toUpperCase() })} />
              <Select
                label="Gender"
                value={editForm.gender || 'M'}
                onChange={v => setEditForm({ ...editForm, gender: v })}
                options={[
                  { value: 'M', label: 'Male' },
                  { value: 'F', label: 'Female' },
                ]}
              />
            </div>
            <Input label="Program" value={editForm.program}
              onChange={e => setEditForm({ ...editForm, program: e.target.value.toUpperCase() })} />
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
        onConfirm={deleteStudent}
        title="Delete Student"
        confirmText="Delete"
        loading={deleteLoading}
      >
        <p className="text-sm text-text-muted">
          Are you sure you want to delete <strong>{deleteTarget?.last_name}, {deleteTarget?.given_name}</strong> ({deleteTarget?.student_id})? This action cannot be undone.
        </p>
      </ConfirmModal>
    </div>
  );
}

function CheckCircleIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
