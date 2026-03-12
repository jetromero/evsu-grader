'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Student, Session, Grade, CriterionKey } from '@/types';
import { RUBRIC_CRITERIA, calculateWeightedScore } from '@/lib/scoring';
import RubricCard from '@/components/rubric/RubricCard';
import ScorePreview from '@/components/rubric/ScorePreview';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/Modal';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { logActivity } from '@/lib/activity-log';

export default function GradingFormPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const sessionId = searchParams.get('session') ?? '';
  const { profile } = useAuth();
  const supabase = createClient();

  const [student, setStudent] = useState<Student | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [existingGrade, setExistingGrade] = useState<Grade | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Score state
  const [scores, setScores] = useState<Partial<Record<CriterionKey, number>>>({});
  const [remarks, setRemarks] = useState<Record<CriterionKey, string>>({
    academic: '', critical: '', communication: '', values: '', leadership: '', professionalism: ''
  });
  const [dishonestyFlag, setDishonestyFlag] = useState(false);
  const [dishonestyNotes, setDishonestyNotes] = useState('');

  useEffect(() => {
    if (!profile || !studentId || !sessionId) return;

    const fetchData = async () => {
      const [studentRes, sessionRes, gradeRes] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId).single(),
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('grades').select('*').eq('student_id', studentId).eq('session_id', sessionId).eq('panelist_id', profile.id).single(),
      ]);

      setStudent(studentRes.data);
      setSession(sessionRes.data);

      if (gradeRes.data) {
        setExistingGrade(gradeRes.data);
        setSubmitted(gradeRes.data.is_locked);

        // Populate form from existing grade
        const g = gradeRes.data;
        setScores({
          academic: g.score_academic ?? undefined,
          critical: g.score_critical ?? undefined,
          communication: g.score_communication ?? undefined,
          values: g.score_values ?? undefined,
          leadership: g.score_leadership ?? undefined,
          professionalism: g.score_professionalism ?? undefined,
        });
        setRemarks({
          academic: g.remarks_academic ?? '',
          critical: g.remarks_critical ?? '',
          communication: g.remarks_communication ?? '',
          values: g.remarks_values ?? '',
          leadership: g.remarks_leadership ?? '',
          professionalism: g.remarks_professionalism ?? '',
        });
        setDishonestyFlag(g.dishonesty_flag);
        setDishonestyNotes(g.dishonesty_notes ?? '');
      }

      setLoading(false);
    };

    fetchData();
  }, [profile, studentId, sessionId]);

  const handleScoreChange = (key: CriterionKey, score: number) => {
    if (submitted) return;
    setScores(prev => ({ ...prev, [key]: score }));
  };

  const handleRemarksChange = (key: CriterionKey, value: string) => {
    if (submitted) return;
    setRemarks(prev => ({ ...prev, [key]: value }));
  };

  const allScoresFilled = RUBRIC_CRITERIA.every(c => scores[c.key] != null);
  const weightedScore = calculateWeightedScore(scores);

  const handleSubmit = async () => {
    if (!profile || !allScoresFilled || !weightedScore) return;
    setSubmitting(true);

    const gradeData = {
      student_id: studentId,
      session_id: sessionId,
      panelist_id: profile.id,
      score_academic: scores.academic!,
      score_critical: scores.critical!,
      score_communication: scores.communication!,
      score_values: scores.values!,
      score_leadership: scores.leadership!,
      score_professionalism: scores.professionalism!,
      remarks_academic: remarks.academic || null,
      remarks_critical: remarks.critical || null,
      remarks_communication: remarks.communication || null,
      remarks_values: remarks.values || null,
      remarks_leadership: remarks.leadership || null,
      remarks_professionalism: remarks.professionalism || null,
      dishonesty_flag: dishonestyFlag,
      dishonesty_notes: dishonestyFlag ? dishonestyNotes : null,
      weighted_score: weightedScore,
      is_locked: true,
    };

    if (existingGrade) {
      const { error } = await supabase.from('grades').update(gradeData).eq('id', existingGrade.id);
      if (error) { toast.error('Failed to update grade'); setSubmitting(false); return; }
    } else {
      const { error } = await supabase.from('grades').insert(gradeData);
      if (error) { toast.error('Failed to submit grade'); setSubmitting(false); return; }
    }

    if (profile) await logActivity(profile.id, profile.full_name, {
      action: existingGrade ? 'updated grade' : 'submitted grade',
      entity_type: 'grade',
      entity_id: studentId,
      details: { session_id: sessionId, score: weightedScore, student: `${student?.last_name}, ${student?.given_name}` },
    });

    toast.success('Grade submitted successfully');
    setSubmitted(true);
    setSubmitting(false);
    setShowConfirm(false);
  };

  if (loading) {
    return (
      <div>
        <div className="h-4 w-36 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-6 mb-6 animate-pulse">
          <div className="h-7 w-64 bg-gray-200 rounded mb-2" />
          <div className="flex gap-2">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-border shadow-sm p-6 animate-pulse">
                <div className="h-5 w-48 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-80 bg-gray-200 rounded mb-4" />
                <div className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="w-10 h-10 bg-gray-200 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="lg:w-80">
            <div className="bg-white rounded-xl border border-border shadow-sm p-6 animate-pulse">
              <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                    <div className="h-3 w-12 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
              <div className="mt-4 h-10 w-full bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/panelist/session/${sessionId}`}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-evsu-maroon mb-4"
      >
        <ArrowLeft size={16} /> Back to Student List
      </Link>

      {/* Submitted banner */}
      {submitted && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-medium text-green-800">Grade Submitted</p>
            <p className="text-xs text-green-600">This grade has been submitted and locked.</p>
          </div>
        </div>
      )}

      {/* Student header */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary font-heading">
              {student?.last_name}, {student?.given_name} {student?.middle_name ?? ''}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm font-mono text-text-muted">{student?.student_id}</span>
              <Badge variant="maroon">{student?.program}</Badge>
            </div>
          </div>
          <div className="text-right text-sm text-text-muted">
            <p className="font-medium">{session?.name}</p>
            <p>{session?.interview_date}</p>
            <p className="text-xs">Panelist: {profile?.full_name}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Rubric scoring area */}
        <div className="flex-1 space-y-4">
          {RUBRIC_CRITERIA.map((criterion, idx) => (
            <RubricCard
              key={criterion.key}
              criterion={criterion}
              index={idx}
              value={scores[criterion.key] ?? null}
              remarks={remarks[criterion.key]}
              onScoreChange={handleScoreChange}
              onRemarksChange={handleRemarksChange}
              disabled={submitted}
            />
          ))}

          {/* Academic Dishonesty Flag */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-red-700 mb-2">Academic Dishonesty</h3>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dishonestyFlag}
                    onChange={e => setDishonestyFlag(e.target.checked)}
                    disabled={submitted}
                    className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-text-primary">
                    I am flagging this student for academic dishonesty.
                    <span className="block text-xs text-red-600 mt-0.5">
                      This will result in AUTOMATIC DISQUALIFICATION.
                    </span>
                  </span>
                </label>
                {dishonestyFlag && (
                  <textarea
                    value={dishonestyNotes}
                    onChange={e => setDishonestyNotes(e.target.value)}
                    disabled={submitted}
                    className="mt-3 w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                    rows={3}
                    placeholder="Provide details about the dishonesty concern..."
                  />
                )}
              </div>
            </div>
          </div>

          {/* Submit button */}
          {!submitted && (
            <div className="flex justify-end pt-4">
              <Button
                size="lg"
                onClick={() => setShowConfirm(true)}
                disabled={!allScoresFilled}
              >
                Submit Grade
              </Button>
            </div>
          )}
        </div>

        {/* Score preview sidebar */}
        <div className="lg:w-80">
          <div className="lg:sticky lg:top-6">
            <ScorePreview scores={scores} />
            {dishonestyFlag && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <AlertTriangle className="text-red-500 mx-auto mb-2" size={24} />
                <p className="text-sm font-medium text-red-700">🚫 DISQUALIFIED</p>
                <p className="text-xs text-red-600 mt-1">Dishonesty flag active</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Confirm Grade Submission"
        confirmText="Submit Grade"
        loading={submitting}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Please review your scores before submitting. Grades cannot be changed after submission.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            {RUBRIC_CRITERIA.map(c => (
              <div key={c.key} className="flex justify-between text-sm">
                <span className="text-text-muted">{c.label}:</span>
                <span className="font-mono font-medium">{scores[c.key]} / 5</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex justify-between text-sm font-medium">
              <span>Weighted Score:</span>
              <span className="font-mono text-lg">
                {weightedScore?.toFixed(2)} / 100
              </span>
            </div>
            {dishonestyFlag && (
              <div className="bg-red-50 rounded p-2 text-sm text-red-700">
                ⚠️ Academic dishonesty flagged — automatic disqualification
              </div>
            )}
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
