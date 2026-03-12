-- Programs table for managing academic programs
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abbreviation TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access to programs"
  ON public.programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- All authenticated users can read programs
CREATE POLICY "Authenticated users can read programs"
  ON public.programs
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed with common EVSU programs (adjust to your campus offerings)
INSERT INTO public.programs (abbreviation, name) VALUES
  ('BSIT', 'Bachelor of Science in Information Technology'),
  ('BSCS', 'Bachelor of Science in Computer Science'),
  ('BSECE', 'Bachelor of Science in Electronics and Communications Engineering'),
  ('BSEE', 'Bachelor of Science in Electrical Engineering'),
  ('BSCE', 'Bachelor of Science in Civil Engineering'),
  ('BSED-ENG', 'Bachelor of Secondary Education Major in English'),
  ('BSED-MATH', 'Bachelor of Secondary Education Major in Mathematics'),
  ('BSED-SCI', 'Bachelor of Secondary Education Major in Science'),
  ('BEED', 'Bachelor of Elementary Education'),
  ('BSBA-MM', 'Bachelor of Science in Business Administration Major in Marketing Management'),
  ('BSBA-FM', 'Bachelor of Science in Business Administration Major in Financial Management'),
  ('BSHRM', 'Bachelor of Science in Hotel and Restaurant Management'),
  ('BSN', 'Bachelor of Science in Nursing'),
  ('BSCRIM', 'Bachelor of Science in Criminology')
ON CONFLICT (abbreviation) DO NOTHING;
