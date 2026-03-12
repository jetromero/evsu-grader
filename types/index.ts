export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'panelist' | 'program_head';
  email: string;
  program?: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  student_id: string;
  last_name: string;
  given_name: string;
  middle_name: string | null;
  gender: 'M' | 'F' | null;
  program: string;
  interview_date: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  name: string;
  interview_date: string;
  program: string;
  status: 'open' | 'closed' | 'finalized';
  created_by: string;
  created_at: string;
}

export interface SessionPanelist {
  id: string;
  session_id: string;
  panelist_id: string;
}

export interface Grade {
  id: string;
  student_id: string;
  session_id: string;
  panelist_id: string;
  score_academic: number | null;
  score_critical: number | null;
  score_communication: number | null;
  score_values: number | null;
  score_leadership: number | null;
  score_professionalism: number | null;
  remarks_academic: string | null;
  remarks_critical: string | null;
  remarks_communication: string | null;
  remarks_values: string | null;
  remarks_leadership: string | null;
  remarks_professionalism: string | null;
  dishonesty_flag: boolean;
  dishonesty_notes: string | null;
  weighted_score: number | null;
  submitted_at: string;
  is_locked: boolean;
}

export interface Result {
  id: string;
  student_id: string;
  session_id: string;
  avg_score: number;
  panel_count: number;
  verdict: 'qualified' | 'not_qualified' | 'disqualified';
  finalized_at: string | null;
  finalized_by: string | null;
}

export interface SessionWithDetails extends Session {
  panelists?: Profile[];
  student_count?: number;
  graded_count?: number;
}

export interface StudentWithGradingStatus extends Student {
  grading_status?: 'not_graded' | 'graded' | 'submitted';
  grade?: Grade | null;
}

export interface ResultWithStudent extends Result {
  student?: Student;
  grades?: (Grade & { panelist?: Profile })[];
}

export type CriterionKey = 'academic' | 'critical' | 'communication' | 'values' | 'leadership' | 'professionalism';

export interface RubricCriterion {
  key: CriterionKey;
  label: string;
  weight: number;
  description: string;
  descriptors: Record<number, string>;
}
