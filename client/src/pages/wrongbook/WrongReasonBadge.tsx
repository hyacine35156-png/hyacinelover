import { useState } from 'react';
import { ChevronDown, Tag } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { setWrongReason } from '@client/src/api/wrongbook';
import type { WrongReason } from '@shared/api.interface';

const REASON_STYLES: Record<WrongReason, string> = {
  concept_unclear: 'bg-blue-500/10 text-blue-600',
  careless: 'bg-amber-500/10 text-amber-600',
  dont_know: 'bg-purple-500/10 text-purple-600',
  no_time: 'bg-pink-500/10 text-pink-600',
  dispute: 'bg-red-500/10 text-red-600',
  other: 'bg-gray-500/10 text-gray-600',
};

const REASON_LABELS: Record<WrongReason, string> = {
  concept_unclear: '概念不清',
  careless: '粗心大意',
  dont_know: '不会做',
  no_time: '时间不够',
  dispute: '题目争议',
  other: '其他',
};

interface WrongReasonBadgeProps {
  questionId: string;
  reason?: WrongReason | null;
  onChanged?: (reason: WrongReason) => void;
  size?: 'sm' | 'default';
}

export const WrongReasonBadge: React.FC<WrongReasonBadgeProps> = ({
  questionId,
  reason,
  onChanged,
  size = 'sm',
}) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localReason, setLocalReason] = useState<WrongReason | null | undefined>(reason);

  const handleValueChange = async (value: string) => {
    const newReason = value as WrongReason;
    try {
      setSaving(true);
      setLocalReason(newReason);
      await setWrongReason(questionId, newReason);
      toast.success(`已标记：${REASON_LABELS[newReason]}`);
      onChanged?.(newReason);
    } catch (error) {
      logger.error('修改错误原因失败', error);
      toast.error('标记失败，请重试');
      setLocalReason(reason ?? null);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  const triggerSize: 'sm' | 'default' = size === 'sm' ? 'sm' : 'default';

  if (!localReason) {
    return (
      <Select open={open} onOpenChange={setOpen} value="" onValueChange={handleValueChange}>
        <SelectTrigger
          size={triggerSize}
          className="h-auto gap-1 border-dashed text-muted-foreground hover:border-primary/40 hover:text-primary"
          aria-label="标记错误原因"
        >
          <Tag className="h-3 w-3" />
          <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>标记原因</span>
          <ChevronDown className="h-3 w-3" />
        </SelectTrigger>
        <SelectContent align="end">
          {Object.entries(REASON_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={localReason}
      onValueChange={handleValueChange}
      disabled={saving}
    >
      <SelectTrigger
        size={triggerSize}
        className={`h-auto gap-1 border-transparent ${REASON_STYLES[localReason]} hover:brightness-95`}
        aria-label="错误原因"
      >
        <SelectValue>
          <span className={`inline-flex items-center gap-1 font-medium ${paddingClass}`}>
            {REASON_LABELS[localReason]}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {Object.entries(REASON_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default WrongReasonBadge;
