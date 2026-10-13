import { getTagColor } from '@client/src/components/TagChip';

interface SubjectPillProps {
  subjectId: string;
  subjectName: string;
  subjectColors: Record<string, string>;
}

/**
 * 题库卡片上的科目标签 pill
 */
const SubjectPill = ({
  subjectId,
  subjectName,
  subjectColors,
}: SubjectPillProps) => {
  const color = subjectColors[subjectId];
  if (color) {
    const colorCfg = getTagColor(color);
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorCfg.bg} ${colorCfg.text}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${colorCfg.dot}`} />
        {subjectName}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {subjectName}
    </span>
  );
};

export default SubjectPill;
