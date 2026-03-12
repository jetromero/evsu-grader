import { createClient } from '@/lib/supabase';

interface LogEntry {
  action: string;
  entity_type: 'session' | 'student' | 'panelist' | 'grade' | 'result' | 'program';
  entity_id?: string;
  details?: Record<string, unknown>;
}

export async function logActivity(
  userId: string,
  userName: string,
  entry: LogEntry,
) {
  const supabase = createClient();
  await supabase.from('activity_logs').insert({
    user_id: userId,
    user_name: userName,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    details: entry.details ?? null,
  });
}
