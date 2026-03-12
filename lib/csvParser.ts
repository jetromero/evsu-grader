export interface ParsedStudent {
  student_id: string;
  last_name: string;
  given_name: string;
  middle_name: string;
  gender: string;
  program: string;
  interview_date: string;
}

// Parse a CSV line respecting quoted fields
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseStudentCSV(csvText: string): ParsedStudent[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const students: ParsedStudent[] = [];
  let currentDate = '';
  let currentProgram = '';

  for (const line of lines) {
    // Try to detect date header lines like "Monday, March 9, 2026" or "March 9, 2026" or "3/9/2026"
    const dateMatch = line.match(
      /^(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(\w+\s+\d{1,2},?\s*\d{4})/i
    );
    const dateMatch2 = line.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dateMatch) {
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        currentDate = parsed.toISOString().split('T')[0];
      }
      continue;
    }
    if (dateMatch2) {
      const [, m, d, y] = dateMatch2;
      currentDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      continue;
    }

    // Try to detect program header lines like "BSIT", "BEED", "BSED-Science", etc.
    const programMatch = line.match(
      /^(BS\w[\w\s-]*|BEED|BPED|BTVTED[\w\s-]*|BSIndTech[\w\s-]*)$/i
    );
    if (programMatch) {
      currentProgram = programMatch[1].trim();
      continue;
    }

    // Skip header rows
    if (
      line.toLowerCase().startsWith('student id') ||
      line.toLowerCase().startsWith('no.') ||
      line.toLowerCase().startsWith('#')
    ) {
      continue;
    }

    // Parse student data row: Student ID, Last Name, Given Name, Middle Name, Gender, Program
    const parts = parseCsvLine(line);
    if (parts.length < 3) continue;

    // Student ID should look numeric (with possible dashes)
    const studentId = parts[0];
    if (!/\d/.test(studentId)) continue;

    // Detect gender from column (M/F/Male/Female)
    let gender = '';
    let programFromRow = '';
    
    // Check if parts[4] is a gender field
    if (parts[4] && /^(M|F|Male|Female)$/i.test(parts[4])) {
      gender = parts[4].charAt(0).toUpperCase();
      programFromRow = parts[5] || '';
    } else if (parts[4]) {
      // parts[4] might be the program
      programFromRow = parts[4];
    }

    const student: ParsedStudent = {
      student_id: studentId,
      last_name: parts[1] || '',
      given_name: parts[2] || '',
      middle_name: parts[3] || '',
      gender: gender,
      program: programFromRow || currentProgram,
      interview_date: currentDate,
    };

    if (student.last_name && student.given_name) {
      students.push(student);
    }
  }

  return students;
}
