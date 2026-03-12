import { RubricCriterion, CriterionKey } from '@/types';

export const RUBRIC_CRITERIA: RubricCriterion[] = [
  {
    key: 'academic',
    label: 'Academic Mastery & Intellectual Depth',
    weight: 0.25,
    description: 'Assesses understanding of the field of study and ability to articulate learning.',
    descriptors: {
      5: 'Exceptional mastery; explains concepts clearly and insightfully',
      4: 'Strong understanding with minor gaps',
      3: 'Adequate understanding; basic explanations',
      2: 'Limited understanding; unclear',
      1: 'Unable to demonstrate academic knowledge',
    },
  },
  {
    key: 'critical',
    label: 'Critical Thinking & Problem-Solving',
    weight: 0.20,
    description: 'Evaluates ability to analyze, reason logically, and propose solutions.',
    descriptors: {
      5: 'Logical, well-reasoned, original',
      4: 'Good analysis with minor weaknesses',
      3: 'Acceptable but limited',
      2: 'Weak analysis, memorized answers',
      1: 'No evidence of critical thinking',
    },
  },
  {
    key: 'communication',
    label: 'Communication Skills',
    weight: 0.20,
    description: 'Measures ability to communicate ideas clearly and confidently.',
    descriptors: {
      5: 'Clear, confident, persuasive',
      4: 'Communicates well with minor lapses',
      3: 'Understandable but lacks confidence',
      2: 'Disorganized or unclear',
      1: 'Unable to communicate effectively',
    },
  },
  {
    key: 'values',
    label: 'Values, Ethics & Integrity',
    weight: 0.15,
    description: 'Evaluates personal values, ethical judgment, and integrity.',
    descriptors: {
      5: 'Strong ethical judgment and integrity',
      4: 'Clear ethical awareness',
      3: 'Acceptable but limited ethical insight',
      2: 'Questionable ethical understanding',
      1: 'Poor ethical judgment',
    },
  },
  {
    key: 'leadership',
    label: 'Leadership, Service & Personal Growth',
    weight: 0.10,
    description: 'Assesses involvement in leadership roles and community service.',
    descriptors: {
      5: 'Strong leadership with deep reflection',
      4: 'Active involvement with clear learning',
      3: 'Some involvement; limited reflection',
      2: 'Minimal involvement',
      1: 'No evidence of leadership or service',
    },
  },
  {
    key: 'professionalism',
    label: 'Overall Impression & Professionalism',
    weight: 0.10,
    description: 'Overall preparedness, composure, and professional bearing.',
    descriptors: {
      5: 'Highly prepared, professional, composed',
      4: 'Generally professional and prepared',
      3: 'Adequate preparation',
      2: 'Poor preparation or unprofessional',
      1: 'Unacceptable conduct',
    },
  },
];

export const SCORE_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Needs Improvement',
  3: 'Satisfactory',
  4: 'Very Good',
  5: 'Excellent',
};

export function calculateWeightedScore(
  scores: Partial<Record<CriterionKey, number>>
): number | null {
  const allFilled = RUBRIC_CRITERIA.every(c => scores[c.key] != null);
  if (!allFilled) return null;

  const raw = RUBRIC_CRITERIA.reduce((sum, c) => {
    return sum + (scores[c.key] ?? 0) * c.weight;
  }, 0);

  return Math.round(raw * 20 * 100) / 100;
}

export function getVerdict(
  avgScore: number,
  hasDishonestyFlag: boolean,
  panelCount: number = 1
): 'qualified' | 'not_qualified' | 'disqualified' | 'pending' {
  if (hasDishonestyFlag) return 'disqualified';
  if (panelCount === 0) return 'pending';
  return avgScore >= 85 ? 'qualified' : 'not_qualified';
}
