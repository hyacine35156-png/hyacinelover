import { X } from 'lucide-react';
import type { QuestionTagItem, LabelType } from '@shared/api.interface';

export interface TagColorConfig {
  name: string;
  bg: string;
  text: string;
  dot: string;
  ring: string;
}

export const TAG_COLORS: TagColorConfig[] = [
  { name: 'blue', bg: 'bg-blue-500/10', text: 'text-blue-700', dot: 'bg-blue-500', ring: 'ring-blue-500/30' },
  { name: 'green', bg: 'bg-green-500/10', text: 'text-green-700', dot: 'bg-green-500', ring: 'ring-green-500/30' },
  { name: 'amber', bg: 'bg-amber-500/10', text: 'text-amber-700', dot: 'bg-amber-500', ring: 'ring-amber-500/30' },
  { name: 'red', bg: 'bg-red-500/10', text: 'text-red-700', dot: 'bg-red-500', ring: 'ring-red-500/30' },
  { name: 'purple', bg: 'bg-purple-500/10', text: 'text-purple-700', dot: 'bg-purple-500', ring: 'ring-purple-500/30' },
  { name: 'pink', bg: 'bg-pink-500/10', text: 'text-pink-700', dot: 'bg-pink-500', ring: 'ring-pink-500/30' },
  { name: 'indigo', bg: 'bg-indigo-500/10', text: 'text-indigo-700', dot: 'bg-indigo-500', ring: 'ring-indigo-500/30' },
  { name: 'teal', bg: 'bg-teal-500/10', text: 'text-teal-700', dot: 'bg-teal-500', ring: 'ring-teal-500/30' },
];

export function getTagColor(color: string): TagColorConfig {
  return TAG_COLORS.find((c) => c.name === color) ?? TAG_COLORS[0];
}

interface TagChipProps {
  tag: Pick<QuestionTagItem, 'name' | 'color'> & { labelType?: LabelType };
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function TagChip({ tag, onRemove, size = 'sm' }: TagChipProps) {
  const colorCfg = getTagColor(tag.color);
  const sizeClass = size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${colorCfg.bg} ${colorCfg.text} font-medium ${sizeClass}`}
    >
      <span className={`h-2 w-2 rounded-full ${colorCfg.dot}`} />
      <span>{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/40"
          aria-label={`移除标签 ${tag.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export default TagChip;
