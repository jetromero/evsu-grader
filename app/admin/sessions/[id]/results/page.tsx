'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Session, Student, Grade, Profile, Result } from '@/types';
import { calculateWeightedScore, getVerdict, RUBRIC_CRITERIA } from '@/lib/scoring';
import Card, { CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { ArrowLeft, FileText, Table, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { logActivity } from '@/lib/activity-log';

interface StudentResult {
  student: Student;
  grades: (Grade & { panelist?: Profile })[];
  avg_score: number;
  panel_count: number;
  verdict: 'qualified' | 'not_qualified' | 'disqualified' | 'pending';
  hasDishonesty: boolean;
}

export default function SessionResultsPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { profile } = useAuth();
  const supabase = createClient();

  const [session, setSession] = useState<Session | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [panelists, setPanelists] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    fetchData();

    // Realtime subscription for grade changes
    const channel = supabase
      .channel('session-grades')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'grades',
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const fetchData = async () => {
    // Get session
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    setSession(sessionData);

    if (!sessionData) { setLoading(false); return; }

    // Get students assigned to this session via session_students
    const { data: ssData } = await supabase
      .from('session_students')
      .select('student_id')
      .eq('session_id', sessionId);

    const studentIds = (ssData ?? []).map((ss: any) => ss.student_id);
    let students: Student[] = [];
    if (studentIds.length > 0) {
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds)
        .order('last_name');
      students = studentsData ?? [];
    }

    // Get all grades for this session
    const { data: grades } = await supabase
      .from('grades')
      .select('*, panelist:profiles!grades_panelist_id_fkey(*)')
      .eq('session_id', sessionId) as { data: (Grade & { panelist?: Profile })[] | null };

    // Get assigned panelists
    const { data: spData } = await supabase
      .from('session_panelists')
      .select('panelist:profiles!session_panelists_panelist_id_fkey(*)')
      .eq('session_id', sessionId);

    const panelistList = (spData ?? []).map((sp: any) => sp.panelist).filter(Boolean);
    setPanelists(panelistList);

    // Compute results
    const results: StudentResult[] = students.map(student => {
      const studentGrades = (grades ?? []).filter(g => g.student_id === student.id);
      const hasDishonesty = studentGrades.some(g => g.dishonesty_flag);

      const validScores = studentGrades
        .filter(g => g.weighted_score != null)
        .map(g => g.weighted_score!);

      const avg_score = validScores.length > 0
        ? validScores.reduce((a, b) => a + b, 0) / validScores.length
        : 0;

      return {
        student,
        grades: studentGrades,
        avg_score: Math.round(avg_score * 100) / 100,
        panel_count: studentGrades.length,
        verdict: getVerdict(avg_score, hasDishonesty, studentGrades.length),
        hasDishonesty,
      };
    });

    // Sort by avg_score descending
    results.sort((a, b) => b.avg_score - a.avg_score);
    setStudentResults(results);
    setLoading(false);
  };

  const handleFinalize = async () => {
    if (!profile || !session) return;
    setFinalizing(true);

    // Save results
    try {
    for (const sr of studentResults) {
      await supabase.from('results').upsert({
        student_id: sr.student.id,
        session_id: sessionId,
        avg_score: sr.avg_score,
        panel_count: sr.panel_count,
        verdict: sr.verdict,
        finalized_at: new Date().toISOString(),
        finalized_by: profile.id,
      }, { onConflict: 'student_id,session_id' });
    }

    // Update session status
    await supabase.from('sessions').update({ status: 'finalized' }).eq('id', sessionId);

    await logActivity(profile.id, profile.full_name, {
      action: 'finalized session',
      entity_type: 'result',
      entity_id: sessionId,
      details: { session: session.name, students: studentResults.length },
    });

    toast.success('Session finalized successfully');
    } catch {
      toast.error('Failed to finalize session');
    }
    setFinalizing(false);
    fetchData();
  };

  const handleReopen = async () => {
    if (!session) return;
    await supabase.from('sessions').update({ status: 'open' }).eq('id', sessionId);

    // Unlock all grades
    await supabase.from('grades').update({ is_locked: false }).eq('session_id', sessionId);

    // Remove finalized results so dashboard stats update correctly
    await supabase.from('results').delete().eq('session_id', sessionId);

    if (profile) await logActivity(profile.id, profile.full_name, {
      action: 'reopened session',
      entity_type: 'session',
      entity_id: sessionId,
      details: { session: session?.name },
    });

    toast.success('Session re-opened');
    fetchData();
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('EVSU Ormoc Campus', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Latin Honors Interview Results', 105, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${session?.name} — ${session?.interview_date}`, 105, 36, { align: 'center' });

    doc.line(20, 40, 190, 40);

    // Table header
    let y = 48;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Rank', 22, y);
    doc.text('Student Name', 36, y);
    doc.text('ID', 100, y);
    doc.text('Program', 130, y);
    doc.text('Score', 155, y);
    doc.text('Verdict', 172, y);

    y += 4;
    doc.line(20, y, 190, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    const filtered = verdictFilter
      ? studentResults.filter(r => r.verdict === verdictFilter)
      : studentResults;

    filtered.forEach((sr, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(i + 1), 22, y);
      doc.text(`${sr.student.last_name}, ${sr.student.given_name}`, 36, y);
      doc.text(sr.student.student_id, 100, y);
      doc.text(sr.student.program, 130, y);
      doc.text(sr.avg_score.toFixed(2), 155, y);
      const vLabel = sr.verdict === 'qualified' ? 'QUALIFIED' :
        sr.verdict === 'disqualified' ? 'DISQUALIFIED' : 'NOT QUALIFIED';
      doc.text(vLabel, 172, y);
      y += 6;
    });

    y += 4;
    doc.line(20, y, 190, y);
    y += 8;

    const qualified = studentResults.filter(r => r.verdict === 'qualified').length;
    const notQualified = studentResults.filter(r => r.verdict === 'not_qualified').length;
    const disqualified = studentResults.filter(r => r.verdict === 'disqualified').length;

    doc.setFontSize(9);
    doc.text(`Total Interviewed: ${studentResults.length}`, 22, y);
    y += 5;
    doc.text(`Qualified: ${qualified} | Not Qualified: ${notQualified} | Disqualified: ${disqualified}`, 22, y);
    y += 10;
    doc.setFontSize(7);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 22, y);
    doc.text(`Prepared by: ${profile?.full_name}`, 22, y + 4);

    doc.save(`${session?.name ?? 'results'}.pdf`);
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');

    // Sheet 1: Summary
    const summaryData = studentResults.map((sr, i) => ({
      Rank: i + 1,
      'Student ID': sr.student.student_id,
      'Last Name': sr.student.last_name,
      'Given Name': sr.student.given_name,
      Program: sr.student.program,
      'Average Score': sr.avg_score,
      'Panel Count': sr.panel_count,
      Verdict: sr.verdict.toUpperCase().replace('_', ' '),
    }));

    // Sheet 2: Per-criterion breakdown
    const criterionData: any[] = [];
    studentResults.forEach(sr => {
      sr.grades.forEach(g => {
        criterionData.push({
          'Student ID': sr.student.student_id,
          'Student Name': `${sr.student.last_name}, ${sr.student.given_name}`,
          Panelist: g.panelist?.full_name ?? 'Unknown',
          'Academic (25%)': g.score_academic,
          'Critical (20%)': g.score_critical,
          'Communication (20%)': g.score_communication,
          'Values (15%)': g.score_values,
          'Leadership (10%)': g.score_leadership,
          'Professionalism (10%)': g.score_professionalism,
          'Weighted Score': g.weighted_score,
        });
      });
    });

    // Sheet 3: Per panelist
    const panelistData: any[] = [];
    studentResults.forEach(sr => {
      const row: any = {
        'Student ID': sr.student.student_id,
        'Student Name': `${sr.student.last_name}, ${sr.student.given_name}`,
      };
      sr.grades.forEach(g => {
        const pName = g.panelist?.full_name ?? 'P';
        row[pName] = g.weighted_score;
      });
      row['Average'] = sr.avg_score;
      row['Verdict'] = sr.verdict.toUpperCase().replace('_', ' ');
      panelistData.push(row);
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(criterionData), 'Criteria Breakdown');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(panelistData), 'Per Panelist');

    XLSX.writeFile(wb, `${session?.name ?? 'results'}.xlsx`);
  };

  const verdictBadge = (v: string) => {
    if (v === 'qualified') return <Badge variant="success">✅ Qualified</Badge>;
    if (v === 'disqualified') return <Badge variant="danger">🚫 Disqualified</Badge>;
    if (v === 'pending') return <Badge variant="info">⏳ Pending</Badge>;
    return <Badge variant="warning">❌ Not Qualified</Badge>;
  };

  const filteredResults = verdictFilter
    ? studentResults.filter(r => r.verdict === verdictFilter)
    : studentResults;

  if (loading) {
    return (
      <div>
        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="text-center py-3">
                <div className="h-6 w-12 bg-gray-200 rounded mx-auto mb-1" />
                <div className="h-3 w-16 bg-gray-200 rounded mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const qualified = studentResults.filter(r => r.verdict === 'qualified').length;
  const notQualified = studentResults.filter(r => r.verdict === 'not_qualified').length;
  const disqualified = studentResults.filter(r => r.verdict === 'disqualified').length;
  const pending = studentResults.filter(r => r.verdict === 'pending').length;

  return (
    <div>
      <Link href="/admin/sessions" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-evsu-maroon mb-4">
        <ArrowLeft size={16} /> Back to Sessions
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-heading">{session?.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="maroon">{session?.program}</Badge>
            <span className="text-sm text-text-muted">{session?.interview_date}</span>
            {session?.status === 'finalized' ? (
              <Badge variant="info">Finalized</Badge>
            ) : session?.status === 'open' ? (
              <Badge variant="success">Open</Badge>
            ) : (
              <Badge variant="warning">Closed</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleExportPDF}>
            <FileText size={16} className="mr-1" /> Export PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportExcel}>
            <Table size={16} className="mr-1" /> Export Excel
          </Button>
          {session?.status !== 'finalized' ? (
            <Button size="sm" onClick={handleFinalize} loading={finalizing}>
              <Lock size={16} className="mr-1" /> Finalize Session
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleReopen}>
              <Unlock size={16} className="mr-1" /> Re-open
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Card>
          <CardContent className="text-center py-3">
            <p className="text-xl font-bold font-mono">{studentResults.length}</p>
            <p className="text-xs text-text-muted">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-3">
            <p className="text-xl font-bold font-mono text-blue-600">{pending}</p>
            <p className="text-xs text-text-muted">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-3">
            <p className="text-xl font-bold font-mono text-green-600">{qualified}</p>
            <p className="text-xs text-text-muted">Qualified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-3">
            <p className="text-xl font-bold font-mono text-orange-600">{notQualified}</p>
            <p className="text-xs text-text-muted">Not Qualified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-3">
            <p className="text-xl font-bold font-mono text-red-600">{disqualified}</p>
            <p className="text-xs text-text-muted">Disqualified</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setVerdictFilter('')}
          className={`px-3 py-1 text-sm rounded-full cursor-pointer ${!verdictFilter ? 'bg-evsu-maroon text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}
        >
          All ({studentResults.length})
        </button>
        <button
          onClick={() => setVerdictFilter('pending')}
          className={`px-3 py-1 text-sm rounded-full cursor-pointer ${verdictFilter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}
        >
          Pending ({pending})
        </button>
        <button
          onClick={() => setVerdictFilter('qualified')}
          className={`px-3 py-1 text-sm rounded-full cursor-pointer ${verdictFilter === 'qualified' ? 'bg-green-600 text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}
        >
          Qualified ({qualified})
        </button>
        <button
          onClick={() => setVerdictFilter('not_qualified')}
          className={`px-3 py-1 text-sm rounded-full cursor-pointer ${verdictFilter === 'not_qualified' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}
        >
          Not Qualified ({notQualified})
        </button>
        <button
          onClick={() => setVerdictFilter('disqualified')}
          className={`px-3 py-1 text-sm rounded-full cursor-pointer ${verdictFilter === 'disqualified' ? 'bg-red-600 text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}
        >
          Disqualified ({disqualified})
        </button>
      </div>

      {/* Results table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-text-muted">#</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Student</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">ID</th>
                {panelists.map(p => (
                  <th key={p.id} className="text-center px-3 py-3 font-medium text-text-muted text-xs">
                    {p.full_name.split(' ').pop()}
                  </th>
                ))}
                <th className="text-center px-4 py-3 font-medium text-text-muted">Average</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">Panels</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">Verdict</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredResults.map((sr, idx) => (
                <React.Fragment key={sr.student.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-text-muted">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">
                        {sr.student.last_name}, {sr.student.given_name}
                      </p>
                      <Badge variant="maroon" className="mt-0.5">{sr.student.program}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{sr.student.student_id}</td>
                    {panelists.map(p => {
                      const grade = sr.grades.find(g => g.panelist_id === p.id);
                      return (
                        <td key={p.id} className="text-center px-3 py-3 font-mono text-xs">
                          {grade?.weighted_score?.toFixed(1) ?? '—'}
                        </td>
                      );
                    })}
                    <td className="text-center px-4 py-3">
                      <span className="font-mono font-bold text-base">{sr.avg_score.toFixed(2)}</span>
                    </td>
                    <td className="text-center px-4 py-3 font-mono">
                      {sr.panel_count}/{panelists.length}
                    </td>
                    <td className="text-center px-4 py-3">{verdictBadge(sr.verdict)}</td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => setExpandedStudent(expandedStudent === sr.student.id ? null : sr.student.id)}
                        className="text-text-muted hover:text-text-primary cursor-pointer"
                      >
                        {expandedStudent === sr.student.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {expandedStudent === sr.student.id && (
                    <tr>
                      <td colSpan={panelists.length + 7} className="px-4 py-4 bg-gray-50">
                        <div className="space-y-3">
                          {sr.grades.map(g => (
                            <div key={g.id} className="bg-white rounded-lg border p-3">
                              <p className="text-sm font-medium mb-2">{g.panelist?.full_name}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                                {RUBRIC_CRITERIA.map(c => {
                                  const scoreKey = `score_${c.key}` as keyof Grade;
                                  const remarksKey = `remarks_${c.key}` as keyof Grade;
                                  return (
                                    <div key={c.key} className="border rounded p-2">
                                      <p className="font-medium text-text-muted">{c.label.split(' ')[0]}</p>
                                      <p className="text-lg font-mono font-bold">{g[scoreKey] as number ?? '—'}</p>
                                      {g[remarksKey] && (
                                        <p className="text-text-muted mt-1 text-xs italic">&ldquo;{g[remarksKey] as string}&rdquo;</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {g.dishonesty_flag && (
                                <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                                  ⚠️ Dishonesty flagged: {g.dishonesty_notes}
                                </div>
                              )}
                            </div>
                          ))}
                          {sr.grades.length === 0 && (
                            <p className="text-sm text-text-muted">No grades submitted yet.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filteredResults.length === 0 && (
          <div className="text-center py-12 text-text-muted">No results found.</div>
        )}
      </Card>
    </div>
  );
}
