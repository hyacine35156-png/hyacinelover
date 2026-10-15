import { useState, useCallback, useEffect } from 'react';
import { Upload, AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
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
import { Progress } from '@client/src/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@client/src/components/ui/radio-group';
import {
  readImportFile,
  importData,
  getImportPreview,
  type ImportStrategy,
  type ImportResult,
  type ImportResultItem,
} from '@client/src/utils/data-import';
import type { ExportData } from '@client/src/utils/data-export';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onFileReset: () => void;
}

const STRATEGY_OPTIONS: { value: ImportStrategy; label: string; description: string }[] = [
  {
    value: 'merge',
    label: '合并',
    description: '合并到现有数据中，同名数据自动跳过',
  },
  {
    value: 'skip',
    label: '跳过',
    description: '保留已有数据，跳过重复项',
  },
  {
    value: 'overwrite',
    label: '覆盖',
    description: '已有数据被导入数据替换（谨慎使用）',
  },
];

const DATA_LABELS: Record<string, string> = {
  questionBanks: '题集',
  questions: '题目',
  practiceRecords: '练习记录',
  favorites: '收藏',
  wrongBook: '错题本',
  tags: '标签',
  settings: '设置',
};

const ImportDialog = ({ open, onOpenChange, file, onFileReset }: ImportDialogProps) => {
  const [importDataState, setImportDataState] = useState<ExportData | null>(null);
  const [parseError, setParseError] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [strategy, setStrategy] = useState<ImportStrategy>('merge');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parsed, setParsed] = useState(false);

  // 文件变化时自动解析
  useEffect(() => {
    if (!file) return;
    if (parsed || isParsing) return;

    let cancelled = false;
    const parseFile = async (): Promise<void> => {
      setIsParsing(true);
      setParseError('');
      setImportDataState(null);
      setResult(null);
      try {
        const data = await readImportFile(file);
        if (!cancelled) {
          setImportDataState(data);
          setParsed(true);
        }
      } catch (error) {
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : '文件解析失败';
          setParseError(msg);
          toast.error('文件解析失败', { description: msg });
        }
      } finally {
        if (!cancelled) setIsParsing(false);
      }
    };
    void parseFile();
    return (): void => {
      cancelled = true;
    };
  }, [file, parsed, isParsing, parseError]);

  // 重置状态（dialog 关闭时）
  const handleOpenChange = (newOpen: boolean): void => {
    if (!newOpen) {
      setImportDataState(null);
      setParseError('');
      setResult(null);
      setProgress(0);
      setProgressText('');
      setIsImporting(false);
      setIsParsing(false);
      setParsed(false);
      onFileReset();
    }
    onOpenChange(newOpen);
  };

  const handleConfirmImport = useCallback(async () => {
    if (!importDataState) return;

    setIsImporting(true);
    setProgress(0);
    setProgressText('准备导入...');

    try {
      const res = await importData(importDataState, {
        strategy,
        onProgress: (phase, current, total) => {
          const percent = Math.round(((current + 0.5) / (total || 1)) * 100);
          setProgress(percent);
          setProgressText(phase);
        },
      });
      setResult(res);
      if (res.totalFailed === 0) {
        toast.success('导入完成', {
          description: `成功 ${res.totalSuccess} 项，跳过 ${res.totalSkipped} 项`,
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        });
      } else {
        toast.warning('部分导入失败', {
          description: `成功 ${res.totalSuccess} 项，失败 ${res.totalFailed} 项`,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '导入失败';
      toast.error('导入失败', { description: msg });
    } finally {
      setIsImporting(false);
      setProgress(100);
    }
  }, [importDataState, strategy]);

  const preview = importDataState ? getImportPreview(importDataState) : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            导入数据
          </DialogTitle>
          <DialogDescription>
             从 JSON 备份文件恢复你的练习数据
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* 解析中 */}
          {isParsing && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">正在解析文件...</span>
            </div>
          )}

          {/* 解析错误 */}
          {parseError && !isParsing && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-800">文件格式错误</p>
                  <p className="mt-1 text-xs text-red-600">{parseError}</p>
                </div>
              </div>
            </div>
          )}

          {/* 预览 + 结果 */}
          {importDataState && !isParsing && !result && (
            <>
              {/* 文件信息 */}
              <div className="rounded-lg border border-border/60 bg-accent/30 p-3">
                <p className="text-xs text-muted-foreground">文件名</p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {file?.name}
                </p>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>版本：{importDataState.version}</span>
                  <span>用户：{importDataState.username}</span>
                </div>
              </div>

              {/* 敏感词提示 */}
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-blue-500" />
                <div>
                  <p className="text-xs font-medium text-blue-800">温馨提示</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-blue-700">
                    题集名称和题目内容中请勿出现"刷题""题库""真题""答题""考试作弊"等敏感字样，
                    以免触发平台风控。建议使用"练习""题集""复习资料""自测"等替代词汇。
                  </p>
                </div>
              </div>

              {/* 数据预览 */}
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">数据预览</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {preview.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-lg border border-border/60 bg-card p-3 text-center"
                    >
                      <p className="text-lg font-bold text-primary">{item.count}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                  {preview.length === 0 && (
                    <div className="col-span-full rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                      文件中没有可导入的数据
                    </div>
                  )}
                </div>
              </div>

              {/* 冲突策略 */}
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">冲突处理方式</p>
                <RadioGroup
                  value={strategy}
                  onValueChange={(v) => setStrategy(v as ImportStrategy)}
                  disabled={isImporting}
                  className="space-y-2"
                >
                  {STRATEGY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        strategy === opt.value
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/60 hover:border-border'
                      }`}
                    >
                      <RadioGroupItem value={opt.value} className="mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {opt.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {opt.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {/* 导入进度 */}
              {isImporting && (
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

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-[11px] text-amber-700">
                  导入操作不可撤销，建议先导出当前数据作为备份
                </p>
              </div>
            </>
          )}

          {/* 导入结果 */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                {result.totalFailed === 0 ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
                <div>
                  <p className="font-medium text-foreground">
                    {result.totalFailed === 0 ? '导入成功' : '部分导入失败'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    成功 {result.totalSuccess} 项 · 失败 {result.totalFailed} 项 · 跳过{' '}
                    {result.totalSkipped} 项
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {result.items.map((item: ImportResultItem) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-3"
                  >
                    <span className="text-sm text-foreground">
                      {DATA_LABELS[item.key] || item.key}
                    </span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-emerald-600">成功 {item.success}</span>
                      {item.failed > 0 && (
                        <span className="text-red-500">失败 {item.failed}</span>
                      )}
                      {item.skipped > 0 && (
                        <span className="text-muted-foreground">
                          跳过 {item.skipped}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {result ? (
            <Button onClick={() => handleOpenChange(false)}>完成</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isImporting}
              >
                取消
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={
                  isImporting ||
                  isParsing ||
                  !importDataState ||
                  preview.length === 0
                }
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    确认导入
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDialog;
