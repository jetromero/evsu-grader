'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import Card, { CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  GraduationCap, CalendarDays, CheckCircle, Clock,
  Upload, PlusCircle, ArrowRight, TrendingUp, Users, Trophy
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, AreaChart, Area, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';

const VERDICT_COLORS = { qualified: '#059669', not_qualified: '#f59e0b', disqualified: '#ef4444' };
const CRITERIA_LABELS: Record<string, string> = {
  academic: 'Academic',
  critical: 'Critical Thinking',
  communication: 'Communication',
  values: 'Values',
  leadership: 'Leadership',
  professionalism: 'Professionalism',
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSessions: 0,
    totalPanelists: 0,
    totalGraded: 0,
    totalPending: 0,
    qualified: 0,
    notQualified: 0,
    disqualified: 0,
  });
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [allGrades, setAllGrades] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [studentsRes, sessionsRes, gradedStudentsRes, resultsRes, panelistsRes, gradesFullRes] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('sessions').select('*').order('interview_date', { ascending: false }).limit(10),
        supabase.from('grades').select('student_id'),
        supabase.from('results').select('*, student:students(program)'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'panelist'),
        supabase.from('grades').select('score_academic, score_critical, score_communication, score_values, score_leadership, score_professionalism, weighted_score, submitted_at, student_id'),
      ]);

      const students = studentsRes.data ?? [];
      const results = resultsRes.data ?? [];
      const grades = gradesFullRes.data ?? [];
      const qualified = results.filter((r: any) => r.verdict === 'qualified').length;
      const notQualified = results.filter((r: any) => r.verdict === 'not_qualified').length;
      const disqualified = results.filter((r: any) => r.verdict === 'disqualified').length;
      const uniqueGradedStudents = new Set((gradedStudentsRes.data ?? []).map((g: any) => g.student_id));

      setStats({
        totalStudents: students.length,
        totalSessions: (sessionsRes.data ?? []).length,
        totalPanelists: panelistsRes.count ?? 0,
        totalGraded: uniqueGradedStudents.size,
        totalPending: students.length - uniqueGradedStudents.size,
        qualified,
        notQualified,
        disqualified,
      });

      setRecentSessions(sessionsRes.data ?? []);
      setAllGrades(grades);
      setAllResults(results);
      setAllStudents(students);

      const { data: recent } = await supabase
        .from('grades')
        .select('*, student:students(last_name, given_name), panelist:profiles!grades_panelist_id_fkey(full_name)')
        .order('submitted_at', { ascending: false })
        .limit(8);

      setRecentActivity(recent ?? []);
      setLoading(false);
    };

    fetchData();
  }, []);

  /* ── Derived chart data ───────────────── */
  const verdictData = useMemo(() => {
    const total = stats.qualified + stats.notQualified + stats.disqualified;
    if (total === 0) return [];
    return [
      { name: 'Qualified', value: stats.qualified, color: VERDICT_COLORS.qualified },
      { name: 'Not Qualified', value: stats.notQualified, color: VERDICT_COLORS.not_qualified },
      { name: 'Disqualified', value: stats.disqualified, color: VERDICT_COLORS.disqualified },
    ];
  }, [stats]);

  const criteriaAvgData = useMemo(() => {
    if (allGrades.length === 0) return [];
    const keys = ['academic', 'critical', 'communication', 'values', 'leadership', 'professionalism'] as const;
    return keys.map(k => {
      const scores = allGrades.map((g: any) => g[`score_${k}`]).filter((v: any) => v != null);
      const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
      return { criterion: CRITERIA_LABELS[k], avg: +avg.toFixed(2), fullMark: 5 };
    });
  }, [allGrades]);

  const gradingTimeline = useMemo(() => {
    if (allGrades.length === 0) return [];
    const byDate: Record<string, number> = {};
    allGrades.forEach((g: any) => {
      if (!g.submitted_at) return;
      const d = new Date(g.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      byDate[d] = (byDate[d] || 0) + 1;
    });
    return Object.entries(byDate).slice(-14).map(([date, count]) => ({ date, grades: count }));
  }, [allGrades]);

  const programDistribution = useMemo(() => {
    const programMap: Record<string, { total: number; qualified: number }> = {};
    allStudents.forEach((s: any) => {
      const p = s.program || 'Unknown';
      if (!programMap[p]) programMap[p] = { total: 0, qualified: 0 };
      programMap[p].total++;
    });
    allResults.forEach((r: any) => {
      const p = r.student?.program || 'Unknown';
      if (!programMap[p]) programMap[p] = { total: 0, qualified: 0 };
      if (r.verdict === 'qualified') programMap[p].qualified++;
    });
    return Object.entries(programMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([name, v]) => ({ name, students: v.total, qualified: v.qualified }));
  }, [allStudents, allResults]);

  const scoreDistribution = useMemo(() => {
    if (allGrades.length === 0) return [];
    const buckets = [
      { range: '1.0–1.9', min: 1, max: 2, count: 0 },
      { range: '2.0–2.9', min: 2, max: 3, count: 0 },
      { range: '3.0–3.5', min: 3, max: 3.5, count: 0 },
      { range: '3.5–4.0', min: 3.5, max: 4, count: 0 },
      { range: '4.0–4.5', min: 4, max: 4.5, count: 0 },
      { range: '4.5–5.0', min: 4.5, max: 5.01, count: 0 },
    ];
    allGrades.forEach((g: any) => {
      const s = g.weighted_score;
      if (s == null) return;
      const b = buckets.find(b => s >= b.min && s < b.max);
      if (b) b.count++;
    });
    return buckets.map(b => ({ range: b.range, count: b.count }));
  }, [allGrades]);

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: GraduationCap, color: 'bg-evsu-maroon/[0.07] text-evsu-maroon' },
    { label: 'Sessions', value: stats.totalSessions, icon: CalendarDays, color: 'bg-blue-50 text-blue-600' },
    { label: 'Panelists', value: stats.totalPanelists, icon: Users, color: 'bg-violet-50 text-violet-600' },
    { label: 'Graded', value: stats.totalGraded, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Pending', value: stats.totalPending, icon: Clock, color: 'bg-orange-50 text-orange-500' },
    { label: 'Finalized', value: stats.qualified + stats.notQualified + stats.disqualified, icon: Trophy, color: 'bg-amber-50 text-amber-600' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-surface-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
        <p className="font-medium text-text-primary mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-text-muted">
            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
            {p.name}: <span className="font-mono font-medium text-text-primary">{p.value}</span>
          </p>
        ))}
      </div>
    );
  };

  /* ── Skeleton ─────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-52 bg-border rounded-xl animate-pulse" />
            <div className="h-4 w-36 bg-border rounded-xl animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-32 bg-border rounded-xl animate-pulse" />
            <div className="h-9 w-36 bg-border rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="flex items-center gap-3">
                <div className="w-10 h-10 bg-border rounded-xl flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-10 bg-border rounded" />
                  <div className="h-3 w-16 bg-border rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[0, 1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse h-72"><CardContent>{' '}</CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  /* ── Actual content ───────────────────── */
  return (
    <div className="space-y-8">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-text-faint uppercase mb-1">Overview</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading leading-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Welcome back, <span className="text-text-secondary font-medium">{profile?.full_name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Link href="/admin/sessions">
            <Button size="sm">
              <PlusCircle size={15} />
              New Session
            </Button>
          </Link>
          <Link href="/admin/students">
            <Button size="sm" variant="outline">
              <Upload size={15} />
              Import Students
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat cards — 6 across */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 py-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold font-mono leading-none">{value}</p>
                <p className="text-[11px] text-text-muted mt-1 truncate">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Verdict Donut + Grading Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Verdict distribution donut */}
        <Card>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-text-primary text-sm">Verdict Distribution</h2>
            <Link href="/admin/results" className="flex items-center gap-1 text-xs text-evsu-maroon hover:underline font-medium">
              View Results <ArrowRight size={12} />
            </Link>
          </div>
          <CardContent className="py-6">
            {verdictData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={verdictData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={2} stroke="var(--color-surface-card)">
                      {verdictData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {verdictData.map(d => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium">{d.name}</p>
                        <p className="text-xs text-text-faint">{d.value} student{d.value !== 1 ? 's' : ''}</p>
                      </div>
                      <p className="text-lg font-bold font-mono text-text-primary">
                        {((d.value / (stats.qualified + stats.notQualified + stats.disqualified)) * 100).toFixed(0)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-text-muted text-sm">
                No finalized results yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grading activity timeline */}
        <Card>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-text-primary text-sm">Grading Activity</h2>
          </div>
          <CardContent className="py-6">
            {gradingTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={gradingTimeline}>
                  <defs>
                    <linearGradient id="gradeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7f1d1d" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7f1d1d" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-text-faint)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-faint)" allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="grades" name="Grades" stroke="#7f1d1d" fill="url(#gradeGradient)" strokeWidth={2} dot={{ r: 3, fill: '#7f1d1d' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-text-muted text-sm">
                No grading data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Criteria Radar + Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Criteria averages radar */}
        <Card>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-text-primary text-sm">Avg. Score by Criteria</h2>
          </div>
          <CardContent className="py-4">
            {criteriaAvgData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={criteriaAvgData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} stroke="var(--color-border)" />
                  <Radar name="Average" dataKey="avg" stroke="#7f1d1d" fill="#7f1d1d" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: '#7f1d1d' }} />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-text-muted text-sm">
                No grades submitted yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score distribution histogram */}
        <Card>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-text-primary text-sm">Score Distribution</h2>
          </div>
          <CardContent className="py-6">
            {scoreDistribution.some(b => b.count > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={scoreDistribution} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="var(--color-text-faint)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-faint)" allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Students" fill="#7f1d1d" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-text-muted text-sm">
                No score data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Program Distribution */}
      {programDistribution.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-text-primary text-sm">Students by Program</h2>
          </div>
          <CardContent className="py-6">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={programDistribution} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-text-faint)" allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="var(--color-text-faint)" width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="students" name="Total" fill="#7f1d1d" radius={[0, 6, 6, 0]} />
                <Bar dataKey="qualified" name="Qualified" fill="#059669" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent sessions + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent sessions */}
        <Card>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays size={15} className="text-text-muted" />
              <h2 className="font-semibold text-text-primary text-sm">Recent Sessions</h2>
            </div>
            <Link href="/admin/sessions" className="flex items-center gap-1 text-xs text-evsu-maroon hover:underline font-medium">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {recentSessions.slice(0, 5).map(s => (
              <Link
                key={s.id}
                href={`/admin/sessions/${s.id}/results`}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-surface transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate group-hover:text-evsu-maroon transition-colors">{s.name}</p>
                  <p className="text-xs text-text-faint mt-0.5">{s.interview_date}</p>
                </div>
                <Badge
                  variant={s.status === 'finalized' ? 'info' : s.status === 'open' ? 'success' : 'warning'}
                  className="ml-3 flex-shrink-0"
                >
                  {s.status}
                </Badge>
              </Link>
            ))}
            {recentSessions.length === 0 && (
              <div className="px-6 py-10 text-center">
                <CalendarDays size={32} className="mx-auto text-border mb-2" />
                <p className="text-sm text-text-muted">No sessions yet</p>
              </div>
            )}
          </div>
        </Card>

        {/* Recent activity */}
        <Card>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-text-muted" />
              <h2 className="font-semibold text-text-primary text-sm">Recent Grading Activity</h2>
            </div>
            <Link href="/admin/logs" className="flex items-center gap-1 text-xs text-evsu-maroon hover:underline font-medium">
              All logs <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {recentActivity.slice(0, 6).map((a, i) => (
              <div key={i} className="px-6 py-3.5">
                <p className="text-sm text-text-primary leading-snug">
                  <span className="font-medium">{a.panelist?.full_name}</span>
                  <span className="text-text-muted"> graded </span>
                  <span className="font-medium">{a.student?.last_name}, {a.student?.given_name}</span>
                </p>
                <p className="text-xs text-text-faint mt-0.5">
                  Score: <span className="font-mono text-text-muted">{a.weighted_score?.toFixed(2)}</span>
                  &nbsp;·&nbsp;
                  {new Date(a.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="px-6 py-10 text-center">
                <TrendingUp size={32} className="mx-auto text-border mb-2" />
                <p className="text-sm text-text-muted">No grading activity yet</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
