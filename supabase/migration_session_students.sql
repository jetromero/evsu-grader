-- EVSU Latin Honors Interview Grading System
-- Migration: Add session_students junction table
-- Run this in the Supabase SQL Editor

-- ============================================
-- TABLE: session_students
-- ============================================
CREATE TABLE IF NOT EXISTS session_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(session_id, student_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_session_students_session_id ON session_students(session_id);
CREATE INDEX IF NOT EXISTS idx_session_students_student_id ON session_students(student_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE session_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage session_students" ON session_students
  FOR ALL USING (is_admin());

CREATE POLICY "Panelists can read session_students for assigned sessions" ON session_students
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM session_panelists WHERE panelist_id = auth.uid()
    )
  );

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE session_students;
