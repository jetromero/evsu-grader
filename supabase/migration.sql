-- EVSU Latin Honors Interview Grading System
-- Supabase Database Migration
-- Run this in the Supabase SQL Editor

-- ============================================
-- TABLE: profiles
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'panelist')),
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- TABLE: students
-- ============================================
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text UNIQUE NOT NULL,
  last_name text NOT NULL,
  given_name text NOT NULL,
  middle_name text,
  gender text CHECK (gender IN ('M', 'F')),
  program text NOT NULL,
  interview_date date,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- TABLE: sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  interview_date date NOT NULL,
  program text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'finalized')),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- TABLE: session_panelists
-- ============================================
CREATE TABLE IF NOT EXISTS session_panelists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  panelist_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(session_id, panelist_id)
);

-- ============================================
-- TABLE: grades
-- ============================================
CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  panelist_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  
  score_academic integer CHECK (score_academic BETWEEN 1 AND 5),
  score_critical integer CHECK (score_critical BETWEEN 1 AND 5),
  score_communication integer CHECK (score_communication BETWEEN 1 AND 5),
  score_values integer CHECK (score_values BETWEEN 1 AND 5),
  score_leadership integer CHECK (score_leadership BETWEEN 1 AND 5),
  score_professionalism integer CHECK (score_professionalism BETWEEN 1 AND 5),
  
  remarks_academic text,
  remarks_critical text,
  remarks_communication text,
  remarks_values text,
  remarks_leadership text,
  remarks_professionalism text,
  
  dishonesty_flag boolean DEFAULT false,
  dishonesty_notes text,
  
  weighted_score numeric(5,2),
  
  submitted_at timestamptz DEFAULT now(),
  is_locked boolean DEFAULT false,
  
  UNIQUE(student_id, session_id, panelist_id)
);

-- ============================================
-- TABLE: results
-- ============================================
CREATE TABLE IF NOT EXISTS results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  avg_score numeric(5,2),
  panel_count integer,
  verdict text CHECK (verdict IN ('qualified', 'not_qualified', 'disqualified')),
  finalized_at timestamptz,
  finalized_by uuid REFERENCES profiles(id),
  UNIQUE(student_id, session_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_students_program ON students(program);
CREATE INDEX IF NOT EXISTS idx_students_interview_date ON students(interview_date);
CREATE INDEX IF NOT EXISTS idx_grades_session_id ON grades(session_id);
CREATE INDEX IF NOT EXISTS idx_grades_panelist_id ON grades(panelist_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_results_session_id ON results(session_id);
CREATE INDEX IF NOT EXISTS idx_session_panelists_session_id ON session_panelists(session_id);
CREATE INDEX IF NOT EXISTS idx_session_panelists_panelist_id ON session_panelists(panelist_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_panelists ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES: users can read their own, admins can read all
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (is_admin() OR id = auth.uid());

-- STUDENTS: all authenticated users can read, admins can insert/update/delete
CREATE POLICY "Authenticated users can read students" ON students
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage students" ON students
  FOR ALL USING (is_admin());

-- SESSIONS: panelists can read assigned sessions, admins can manage all
CREATE POLICY "Admins can manage sessions" ON sessions
  FOR ALL USING (is_admin());

CREATE POLICY "Panelists can read assigned sessions" ON sessions
  FOR SELECT USING (
    id IN (
      SELECT session_id FROM session_panelists WHERE panelist_id = auth.uid()
    )
  );

-- SESSION_PANELISTS: admins can manage, panelists can read own
CREATE POLICY "Admins can manage session_panelists" ON session_panelists
  FOR ALL USING (is_admin());

CREATE POLICY "Panelists can read own session assignments" ON session_panelists
  FOR SELECT USING (panelist_id = auth.uid());

-- GRADES: panelists can read/write own, admins can read/write all
CREATE POLICY "Admins can manage grades" ON grades
  FOR ALL USING (is_admin());

CREATE POLICY "Panelists can read own grades" ON grades
  FOR SELECT USING (panelist_id = auth.uid());

CREATE POLICY "Panelists can insert own grades" ON grades
  FOR INSERT WITH CHECK (panelist_id = auth.uid());

CREATE POLICY "Panelists can update own unlocked grades" ON grades
  FOR UPDATE USING (panelist_id = auth.uid() AND is_locked = false);

-- RESULTS: readable after finalization by all authenticated users
CREATE POLICY "Admins can manage results" ON results
  FOR ALL USING (is_admin());

CREATE POLICY "Authenticated users can read finalized results" ON results
  FOR SELECT USING (auth.uid() IS NOT NULL AND finalized_at IS NOT NULL);

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE grades;
ALTER PUBLICATION supabase_realtime ADD TABLE results;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;

-- ============================================
-- SEED: Create initial admin user
-- After running this migration, create a user in Supabase Auth
-- with email "admin@evsu.edu.ph" and your chosen password,
-- then insert a profile row:
-- ============================================
-- INSERT INTO profiles (id, full_name, role, email)
-- VALUES ('<auth-user-uuid>', 'Admin User', 'admin', 'admin@evsu.edu.ph');
