import { difficultyColor } from '@/lib/format';

export function FixtureChip({
  label,
  difficulty,
  title,
}: {
  label: string;
  difficulty: number;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-block rounded border border-line px-1.5 py-0.5 text-xs tnum"
      style={{ color: difficultyColor(difficulty) }}
    >
      {label}
    </span>
  );
}
