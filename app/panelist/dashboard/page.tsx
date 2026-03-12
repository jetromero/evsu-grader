'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import Card, { CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { CalendarDays, Users, CheckCircle, Clock } from 'lucide-react';

interface SessionWithMeta {
  id: string;
  name: string;
  interview_date: string;
  program: string;
  status: string;
  student_count: number;
  graded_count: number;
}

export default function PanelistDashboard() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<SessionWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!profile) return;

    const fetchSessions = async () => {
      // Get assigned sessions
      const { data: assignments } = await supabase
        .from('session_panelists')
        .select('session_id')
        .eq('panelist_id', profile.id);

      if (!assignments?.length) {
        setLoading(false);
        return;
      }

      const sessionIds = assignments.map((a: { session_id: string }) => a.session_id);

      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .in('id', sessionIds)
        .order('interview_date', { ascending: true });

      if (!sessionsData) {
        setLoading(false);
        return;
      }

      // For each session, count students from session_students and how many I've graded
      const enriched: SessionWithMeta[] = [];
      for (const s of sessionsData) {
        const { count: studentCount } = await supabase
          .from('session_students')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', s.id);

        const { count: gradedCount } = await supabase
          .from('grades')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', s.id)
          .eq('panelist_id', profile.id);

        enriched.push({
          ...s,
          student_count: studentCount ?? 0,
          graded_count: gradedCount ?? 0,
        });
      }

      setSessions(enriched);
      setLoading(false);
    };

    fetchSessions();
  }, [profile]);

  const totalGraded = sessions.reduce((s, x) => s + x.graded_count, 0);
  const totalStudents = sessions.reduce((s, x) => s + x.student_count, 0);
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s => s.interview_date === today);

  const statusBadge = (status: string) => {
    if (status === 'open') return <Badge variant="success">Open</Badge>;
    if (status === 'closed') return <Badge variant="warning">Closed</Badge>;
    return <Badge variant="info">Finalized</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-3 w-28 bg-border rounded animate-pulse mb-2" />
          <div className="h-8 w-56 bg-border rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="flex items-center gap-4">
                <div className="w-12 h-12 bg-border rounded-xl" />
                <div className="space-y-2">
                  <div className="h-6 w-12 bg-border rounded" />
                  <div className="h-3 w-24 bg-border rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-5 w-40 bg-border rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent>
                <div className="space-y-3">
                  <div className="h-5 w-32 bg-border rounded" />
                  <div className="h-4 w-24 bg-border rounded" />
                  <div className="h-2 w-full bg-border rounded-full" />
                  <div className="h-8 w-20 bg-border rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const completionPct = totalStudents > 0 ? Math.round((totalGraded / totalStudents) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header with overall progress */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-text-faint uppercase mb-1">Panelist</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">
            Welcome, {profile?.full_name}
          </h1>
          <p className="text-text-muted text-sm mt-1">Here are your assigned sessions</p>
        </div>
        {totalStudents > 0 && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-text-muted">Overall Progress</p>
              <p className="text-sm font-bold font-mono">{totalGraded}/{totalStudents}</p>
            </div>
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle
                  cx="22" cy="22" r="18" fill="none"
                  stroke="var(--color-evsu-maroon)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${completionPct * 1.131} 113.1`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono">
                {completionPct}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 bg-evsu-maroon/10 rounded-xl flex items-center justify-center">
              <CalendarDays className="text-evsu-maroon" size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{sessions.length}</p>
              <p className="text-xs text-text-muted">Assigned Sessions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="text-green-600" size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{totalGraded}</p>
              <p className="text-xs text-text-muted">Students Graded</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
              <Clock className="text-orange-500" size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{totalStudents - totalGraded}</p>
              <p className="text-xs text-text-muted">Remaining</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's sessions - highlighted */}
      {todaySessions.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-text-primary mb-3 font-heading flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Today&apos;s Sessions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todaySessions.map(s => {
              const pct = s.student_count ? Math.round((s.graded_count / s.student_count) * 100) : 0;
              const isDone = s.graded_count >= s.student_count && s.student_count > 0;
              return (
                <Card key={s.id} className="hover:shadow-md hover:-translate-y-0.5 transition-all border-l-4 border-l-evsu-maroon">
                  <CardContent>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-text-primary">{s.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                          <CalendarDays size={12} />
                          {s.interview_date}
                        </div>
                      </div>
                      {isDone ? (
                        <Badge variant="success">Complete</Badge>
                      ) : (
                        statusBadge(s.status)
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
                      <Badge variant="maroon">{s.program}</Badge>
                      <span><Users size={12} className="inline mr-1" />{s.student_count} students</span>
                    </div>
                    {/* Progress */}
                    <div className="w-full bg-surface-alt rounded-full h-2.5 mb-3">
                      <div
                        className={`rounded-full h-2.5 transition-all ${isDone ? 'bg-green-500' : 'bg-evsu-maroon'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted font-mono">
                        {s.graded_count}/{s.student_count} graded ({pct}%)
                      </span>
                      <Link href={`/panelist/session/${s.id}`}>
                        <Button size="sm">{isDone ? 'Review' : 'Start Grading'}</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* All sessions */}
      <div>
        <h2 className="text-base font-semibold text-text-primary mb-3 font-heading">
          All Assigned Sessions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(s => {
            const pct = s.student_count ? Math.round((s.graded_count / s.student_count) * 100) : 0;
            const isDone = s.graded_count >= s.student_count && s.student_count > 0;

            return (
              <Card key={s.id} className="hover:shadow-md hover:-translate-y-0.5 transition-all">
              <CardContent>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-text-primary text-sm truncate">{s.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                      <CalendarDays size={11} />
                      {s.interview_date}
                    </div>
                  </div>
                  {isDone ? (
                    <Badge variant="success">Done</Badge>
                  ) : (
                    statusBadge(s.status)
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
                  <Badge variant="maroon">{s.program}</Badge>
                  <span>{s.student_count} students</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-surface-alt rounded-full h-2 mb-2">
                  <div
                    className={`rounded-full h-2 transition-all ${isDone ? 'bg-green-500' : 'bg-evsu-maroon'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted font-mono">
                    {s.graded_count}/{s.student_count} ({pct}%)
                  </span>
                  <Link href={`/panelist/session/${s.id}`}>
                    <Button size="sm" variant={s.status === 'open' && !isDone ? 'primary' : 'outline'}>
                      {isDone ? 'Review' : s.status === 'open' ? 'Grade' : 'View'}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {sessions.length === 0 && (
          <div className="col-span-full text-center py-12 text-text-muted">
            <CalendarDays size={48} className="mx-auto mb-3 opacity-30" />
            <p>No sessions assigned to you yet.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
