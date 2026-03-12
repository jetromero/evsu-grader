'use client';

import { RubricCriterion, CriterionKey } from '@/types';
import { SCORE_LABELS } from '@/lib/scoring';

interface ScoreButtonProps {
  score: number;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ScoreButton({ score, selected, onClick, disabled }: ScoreButtonProps) {
  const colors: Record<number, string> = {
    1: 'border-red-300 hover:bg-red-50 text-red-700',
    2: 'border-orange-300 hover:bg-orange-50 text-orange-700',
    3: 'border-yellow-300 hover:bg-yellow-50 text-yellow-700',
    4: 'border-green-300 hover:bg-green-50 text-green-700',
    5: 'border-emerald-400 hover:bg-emerald-50 text-emerald-800',
  };

  const selectedColors: Record<number, string> = {
    1: 'bg-red-500 border-red-500 text-white',
    2: 'bg-orange-500 border-orange-500 text-white',
    3: 'bg-yellow-500 border-yellow-500 text-white',
    4: 'bg-green-500 border-green-500 text-white',
    5: 'bg-emerald-600 border-emerald-600 text-white',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center min-w-[80px] px-3 py-2 border-2 rounded-lg transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
        selected ? selectedColors[score] : colors[score]
      }`}
    >
      <span className="text-lg font-bold font-mono">{score}</span>
      <span className="text-xs mt-0.5">{SCORE_LABELS[score]}</span>
    </button>
  );
}

interface RubricCardProps {
  criterion: RubricCriterion;
  index: number;
  value: number | null;
  remarks: string;
  onScoreChange: (key: CriterionKey, score: number) => void;
  onRemarksChange: (key: CriterionKey, remarks: string) => void;
  disabled?: boolean;
}

export default function RubricCard({
  criterion, index, value, remarks, onScoreChange, onRemarksChange, disabled
}: RubricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-6">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-text-primary">
            <span className="text-evsu-maroon mr-1">{index + 1}.</span>
            {criterion.label}
            <span className="ml-2 text-sm font-normal text-text-muted">
              ({(criterion.weight * 100).toFixed(0)}%)
            </span>
          </h3>
        </div>
        <p className="text-sm text-text-muted mt-1">{criterion.description}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[1, 2, 3, 4, 5].map(score => (
          <ScoreButton
            key={score}
            score={score}
            selected={value === score}
            onClick={() => onScoreChange(criterion.key, score)}
            disabled={disabled}
          />
        ))}
      </div>

      {value && (
        <div className="mb-4 px-3 py-2 bg-gray-50 rounded-lg border border-border">
          <p className="text-sm text-text-primary">
            <span className="font-medium">Score {value}:</span>{' '}
            {criterion.descriptors[value]}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-muted mb-1">
          Remarks (optional)
        </label>
        <textarea
          value={remarks}
          onChange={(e) => onRemarksChange(criterion.key, e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-evsu-maroon/20 focus:border-evsu-maroon disabled:bg-gray-50"
          rows={2}
          placeholder="Add optional remarks..."
        />
      </div>
    </div>
  );
}
