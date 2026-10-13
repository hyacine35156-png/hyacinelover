import { useState, useEffect } from 'react';
import { BookOpen, Brain, Zap, Check } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';

export type PracticeMode = 'basic' | 'recite' | 'quick';

interface PracticeModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: PracticeMode) => void;
  defaultMode?: PracticeMode;
  bankName?: string;
  questionCount?: number;
}

interface ModeOption {
  key: PracticeMode;
  title: string;
  description: string;
  icon: typeof BookOpen;
}

export const MODE_OPTIONS: ModeOption[] = [
  {
    key: 'basic',
    title: '基础模式',
    description: '标准练习，作答后查看解析，手动点下一题',
    icon: BookOpen,
  },
  {
    key: 'recite',
    title: '速记模式',
    description: '直接显示答案和解析，快速浏览记忆，不记录作答',
    icon: Brain,
  },
  {
    key: 'quick',
    title: '速读模式',
    description: '答对自动跳转下一题，答错停留查看解析',
    icon: Zap,
  },
];

function PracticeModeDialog({
  open,
  onOpenChange,
  onSelect,
  defaultMode = 'basic',
  bankName,
  questionCount,
}: PracticeModeDialogProps) {
  const [selected, setSelected] = useState<PracticeMode>(defaultMode);

  useEffect(() => {
    if (open) {
      setSelected(defaultMode);
    }
  }, [open, defaultMode]);

  const handleStart = () => {
    onSelect(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>选择练习模式</DialogTitle>
          <DialogDescription>
            根据你的学习节奏选择合适的模式
            {bankName && (
              <span className="ml-1">
                · {bankName}
                {typeof questionCount === 'number' && (
                  <span className="ml-1">（共 {questionCount} 题）</span>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            {MODE_OPTIONS.map((option) => {
              const isSelected = selected === option.key;
              const Icon = option.icon;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelected(option.key)}
                  className={[
                    'relative flex items-start gap-3 rounded-xl border p-4 text-left',
                    'transition-all duration-200 hover:shadow-md',
                    isSelected
                      ? 'border-primary/60 bg-accent/60 shadow-sm'
                      : 'border-border/60 bg-card hover:border-primary/30',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                      isSelected
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={[
                        'font-semibold text-base',
                        isSelected ? 'text-foreground' : 'text-foreground/90',
                      ].join(' ')}
                    >
                      {option.title}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleStart}
            className="bg-gradient-to-r from-primary to-pink-500 text-primary-foreground border-0 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
          >
             开始练习
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PracticeModeDialog;
