import { useState, useCallback } from 'react';
import { Download, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Progress } from '@client/src/components/ui/progress';
import {
  exportData,
  EXPORT_DATA_TYPES,
  type ExportDataType,
} from '@client/src/utils/data-export';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ExportDialog = ({ open, onOpenChange }: ExportDialogProps) => {
  const [selectedTypes, setSelectedTypes] = useState<ExportDataType[]>(
    EXPORT_DATA_TYPES.map((t) => t.key),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  const handleToggleType = (key: ExportDataType, checked: boolean): void => {
    setSelectedTypes((prev) =>
      checked ? [...prev, key] : prev.filter((t) => t !== key),
    );
  };

  const handleSelectAll = (): void => {
    if (selectedTypes.length === EXPORT_DATA_TYPES.length) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(EXPORT_DATA_TYPES.map((t) => t.key));
    }
  };

  const handleExport = useCallback(async () => {
    if (selectedTypes.length === 0) {
      toast.error('请至少选择一项要导出的数据');
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setProgressText('准备导出...');

    try {
      await exportData({
        types: selectedTypes,
        onProgress: (step, current, total) => {
          const percent = Math.round((current / total) * 100);
          setProgress(percent);
          const stepLabels: Record<string, string> = {
            user: '获取用户信息',
            questionBanks: '导出题集',
            questions: '导出题目',
            practiceRecords: '导出练习记录',
            favorites: '导出收藏',
            wrongBook: '导出错题本',
            tags: '导出标签',
            settings: '导出设置',
            download: '生成下载文件',
          };
          setProgressText(stepLabels[step] || step);
        },
      });
      toast.success('数据导出成功', {
        description: '文件已开始下载',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });
      onOpenChange(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '导出失败';
      toast.error('导出失败', { description: msg });
    } finally {
      setIsExporting(false);
      setProgress(0);
      setProgressText('');
    }
  }, [selectedTypes, onOpenChange]);

  const allSelected = selectedTypes.length === EXPORT_DATA_TYPES.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            导出数据
          </DialogTitle>
          <DialogDescription>
            选择要导出的数据类型，导出为 JSON 备份文件
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              选择数据类型
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-auto px-2 py-1 text-xs"
            >
              {allSelected ? '取消全选' : '全选'}
            </Button>
          </div>

          <div className="space-y-2">
            {EXPORT_DATA_TYPES.map((item) => {
              const checked = selectedTypes.includes(item.key);
              return (
                <label
                  key={item.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    checked
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/60 hover:border-border'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => handleToggleType(item.key, !!c)}
                    disabled={isExporting}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {isExporting && (
            <div className="space-y-2 rounded-lg bg-accent/50 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {progressText}
                </span>
                <span className="text-xs text-muted-foreground">
                  {progress}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            💡 导出文件包含个人数据，请注意妥善保存，不要分享给他人
          </p>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            取消
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedTypes.length === 0}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                确认导出
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
