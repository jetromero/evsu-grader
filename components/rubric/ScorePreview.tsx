'use client';

import { CriterionKey } from '@/types';
import { RUBRIC_CRITERIA, calculateWeightedScore } from '@/lib/scoring';

interface ScorePreviewProps {
  scores: Partial<Record<CriterionKey, number>>;
}

export default function ScorePreview({ scores }: ScorePreviewProps) {
  const weightedScore = calculateWeightedScore(scores);
  const rawTotal = RUBRIC_CRITERIA.reduce((sum, c) => {
    return sum + (scores[c.key] ?? 0) * c.weight;
  }, 0);

  const allFilled = RUBRIC_CRITERIA.every(c => scores[c.key] != null);

  let verdictLabel = '—';
  let verdictColor = 'text-text-muted';
  if (weightedScore !== null) {
    if (weightedScore >= 85) {
      verdictLabel = '✅ QUALIFIED';
      verdictColor = 'text-green-600';
    } else {
      verdictLabel = '❌ NOT QUALIFIED';
      verdictColor = 'text-red-600';
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-evsu-maroon mb-4 font-heading">
        Your Computed Score
      </h3>

      <div className="space-y-2 mb-4">
        {RUBRIC_CRITERIA.map(c => {
          const score = scores[c.key];
          const weighted = score ? (score * c.weight).toFixed(2) : '—';
          return (
            <div key={c.key} className="flex justify-between text-sm font-mono">
              <span className="text-text-muted">
                {c.label.split(' ')[0]} ({(c.weight * 100).toFixed(0)}%):
              </span>
              <span className="text-text-primary">
                {score ?? '—'} × {c.weight.toFixed(2)} = {weighted}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex justify-between font-mono text-sm">
          <span className="font-medium">Weighted Total:</span>
          <span className="font-bold">{rawTotal.toFixed(2)} / 5.00</span>
        </div>
        <div className="flex justify-between font-mono text-sm">
          <span className="font-medium">Score out of 100:</span>
          <span className="font-bold text-lg">
            {allFilled ? weightedScore?.toFixed(2) : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium font-mono">Verdict Preview:</span>
          <span className={`font-bold text-base ${verdictColor}`}>
            {verdictLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
