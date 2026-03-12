'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Session, Student, Grade } from '@/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Search, User, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PanelistSessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { profile } = useAuth();
  const supabase = createClient();

  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !sessionId) return;

    const fetchData = async () => {
      // Get session
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionData) {
        setSession(sessionData);

        // Get students assigned to this session via session_students
        const { data: ssData } = await supabase
          .from('session_students')
          .select('student_id')
          .eq('session_id', sessionId);

        const studentIds = (ssData ?? []).map((ss: any) => ss.student_id);
        if (studentIds.length > 0) {
          const { data: studentsData } = await supabase
            .from('students')
            .select('*')
            .in('id', studentIds)
            .order('last_name', { ascending: true });
          setStudents(studentsData ?? []);
        }
      }

      // Get my grades for this session
      const { data: gradesData } = await supabase
        .from('grades')
        .select('*')
        .eq('session_id', sessionId)
        .eq('panelist_id', profile.id);

      setGrades(gradesData ?? []);
      setLoading(false);
    };

    fetchData();
  }, [profile, sessionId]);

  const getGradingStatus = (studentId: string) => {
    const grade = grades.find(g => g.student_id === studentId);
    if (!grade) return 'not_graded';
    if (grade.is_locked) return 'submitted';
    return 'graded';
  };

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    return (
      s.last_name.toLowerCase().includes(q) ||
      s.given_name.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q)
    );
  });

  const statusBadge = (status: string) => {
    if (status === 'not_graded') return <Badge variant="default">Not Yet Graded</Badge>;
    if (status === 'graded') return <Badge variant="success">Graded</Badge>;
    return <Badge variant="info">Submitted</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-4 w-28 bg-border rounded animate-pulse" />
        {/* Session banner skeleton */}
        <div className="bg-border/40 rounded-2xl h-36 animate-pulse" />
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map(i => (
            <div key={i} className="h-16 bg-border rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-10 bg-border rounded-xl animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const gradedCount = students.filter(s => getGradingStatus(s.id) !== 'not_graded').length;
  const pct = students.length > 0 ? Math.round((gradedCount / students.length) * 100) : 0;

  // Sort: ungraded first, then graded, then submitted
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const order = { not_graded: 0, graded: 1, submitted: 2 };
    return order[getGradingStatus(a.id)] - order[getGradingStatus(b.id)];
  });

  const submittedCount = students.filter(s => getGradingStatus(s.id) === 'submitted').length;
  const inProgressCount = students.filter(s => getGradingStatus(s.id) === 'graded').length;
  const pendingCount = students.filter(s => getGradingStatus(s.id) === 'not_graded').length;

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <Link href="/panelist/dashboard" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-evsu-maroon transition-colors">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      {/* Session banner */}
      <div className="relative bg-evsu-maroon rounded-2xl overflow-hidden">
        {/* Decorative ring */}
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 right-24 w-32 h-32 rounded-full bg-white/[0.04]" />

        <div className="relative px-5 sm:px-7 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1">Interview Session</p>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading leading-tight">
              {session?.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/15 text-white text-xs font-medium">
                {session?.program}
              </span>
              <span className="text-white/50 text-xs">{session?.interview_date}</span>
              {session?.status === 'open' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-400/20 text-green-300 text-xs font-semibold">Open</span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs font-semibold">Closed</span>
              )}
            </div>
          </div>

          {/* Circular progress */}
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                <circle
                  cx="22" cy="22" r="18" fill="none"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${pct * 1.131} 113.1`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono text-white">
                {pct}%
              </span>
            </div>
            <div className="sm:text-right">
              <p className="text-white font-bold font-mono text-lg leading-none">{gradedCount}/{students.length}</p>
              <p className="text-white/50 text-xs mt-0.5">students graded</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/10">
          <div
            className={`h-1.5 transition-all ${pct === 100 ? 'bg-green-400' : 'bg-white/70'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: pendingCount, color: 'text-text-muted', bg: 'bg-surface' },
          { label: 'In Progress', value: inProgressCount, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Submitted', value: submittedCount, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl px-4 py-3 border border-border`}>
            <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
            <p className="text-xs text-text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or student ID..."
          className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-evsu-maroon/20 focus:border-evsu-maroon"
        />
      </div>

      {/* Student list */}
      <div className="space-y-2">
        {sortedStudents.map(student => {
          const status = getGradingStatus(student.id);
          const grade = grades.find(g => g.student_id === student.id);

          return (
            <div
              key={student.id}
              className={`bg-white rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${
                status === 'submitted'
                  ? 'border-green-200'
                  : status === 'graded'
                    ? 'border-blue-200'
                    : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Left color indicator */}
                <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                  status === 'submitted' ? 'bg-green-400'
                  : status === 'graded' ? 'bg-blue-400'
                  : 'bg-border'
                }`} />

                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  status === 'not_graded' ? 'bg-surface text-text-muted'
                  : status === 'submitted' ? 'bg-green-100 text-green-600'
                  : 'bg-blue-100 text-blue-600'
                }`}>
                  <User size={16} />
                </div>

                {/* Student info */}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary text-sm leading-tight">
                    {student.last_name}, {student.given_name}{student.middle_name ? ` ${student.middle_name}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-muted font-mono">{student.student_id}</span>
                    <span className="text-[10px] font-medium text-evsu-maroon bg-evsu-maroon/8 px-1.5 py-0.5 rounded">{student.program}</span>
                  </div>
                </div>

                {/* Score */}
                {grade?.weighted_score != null && (
                  <div className="hidden sm:flex flex-col items-end">
                    <p className="text-base font-mono font-bold text-text-primary">{grade.weighted_score.toFixed(1)}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wide">score</p>
                  </div>
                )}

                {/* Status badge + action */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="hidden sm:block">{statusBadge(status)}</div>
                  <Link href={`/panelist/grade/${student.id}?session=${sessionId}`}>
                    <Button size="sm" variant={status === 'not_graded' ? 'primary' : 'outline'}>
                      {status === 'not_graded' ? 'Grade' : 'View'}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sortedStudents.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          <User size={44} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">{search ? 'No students match your search.' : 'No students assigned to this session.'}</p>
        </div>
      )}
    </div>
  );
}
