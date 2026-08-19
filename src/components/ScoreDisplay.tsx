import { type PostureCategory } from '../services/AlertManager';

const COLORS: Record<PostureCategory, string> = {
  Good: '#10B981', // green
  Warning: '#F59E0B', // yellow
  Bad: '#EF4444', // red
};

const BADGES: Record<PostureCategory, string> = {
  Good: '🟢',
  Warning: '🟡',
  Bad: '🔴',
};

interface ScoreDisplayProps {
  score: number | null;
  category: PostureCategory | null;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score, category }) => {
  if (score === null || category === null) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-100 rounded-lg shadow">
        <div className="text-gray-500 text-xl">Waiting for detection...</div>
      </div>
    );
  }

  const color = COLORS[category];
  const badge = BADGES[category];

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      <div
        className="text-6xl font-bold mb-2"
        style={{ color }}
      >
        {score}
      </div>
      <div
        className="text-2xl font-semibold flex items-center gap-2"
        style={{ color }}
      >
        <span>{badge}</span>
        <span>{category}</span>
      </div>
    </div>
  );
};