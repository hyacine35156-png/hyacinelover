import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Progress } from '@client/src/components/ui/progress';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

import {
  getWrongBookExportList,
  type WrongBookExportItem,
} from '@client/src/api/wrongbook';
import type {
  ExportFormat,
  AnswerMode,
  WrongReason,
  QuestionType,
  QuestionOption,
} from '@shared/api.interface';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultReason?: WrongReason;
  defaultDifficulty?: string;
}

const WRONG_REASON_OPTIONS: { value: WrongReason; label: string }[] = [
  { value: 'concept_unclear', label: '概念不清' },
  { value: 'careless', label: '粗心大意' },
  { value: 'dont_know', label: '不会做' },
  { value: 'no_time', label: '时间不够' },
  { value: 'dispute', label: '题目争议' },
  { value: 'other', label: '其他' },
];

const WRONG_REASON_LABELS: Record<WrongReason, string> = {
  concept_unclear: '概念不清',
  careless: '粗心大意',
  dont_know: '不会做',
  no_time: '时间不够',
  dispute: '题目争议',
  other: '其他',
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  b1: 'B1型题',
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderOptions(options: QuestionOption[]): string {
  if (!options || options.length === 0) return '';
  return options
    .map((opt) => `<div style="margin:4px 0;">${escapeHtml(opt.label)}. ${escapeHtml(opt.text)}</div>`)
    .join('');
}

function getAnswerLabels(q: WrongBookExportItem): string {
  return (q.correctAnswers || [])
    .map((i: number) => q.options[i]?.label || '')
    .filter(Boolean)
    .join('、');
}

function buildAnswerSummaryHtml(questions: WrongBookExportItem[]): string {
  const lines: string[] = [];
  let globalIdx = 0;
  questions.forEach((q, qIdx) => {
    if (q.questionType === 'b1' && q.subQuestions && q.subQuestions.length > 0) {
      q.subQuestions.forEach((sub: any, sIdx: number) => {
        globalIdx += 1;
        const labels = (sub.correctAnswer ? [sub.correctAnswer] : [])
          .map((label: string | number) => {
            if (typeof label === 'number') return q.options[label]?.label || '';
            return label;
          })
          .join('、');
        lines.push(
          `<div style="margin: 4px 0;">${qIdx + 1}-${sIdx + 1}. ${escapeHtml(labels || '无')}</div>`,
        );
      });
    } else {
      globalIdx += 1;
      lines.push(
        `<div style="margin: 4px 0;">${qIdx + 1}. ${escapeHtml(getAnswerLabels(q) || '无')}</div>`,
      );
    }
  });

  return `
    <div style="margin-top: 32px; padding-top: 20px; border-top: 2px solid #8b5cf6;">
      <h2 style="color: #8b5cf6; font-size: 18px; margin-bottom: 12px;">答案汇总</h2>
      <div style="columns: 2; -webkit-columns: 2; column-gap: 24px; font-size: 14px; color: #374151;">
        ${lines.join('')}
      </div>
    </div>
  `;
}

function buildExportHtml(questions: WrongBookExportItem[], answerMode: AnswerMode = 'show'): string {
  const itemsHtml = questions
    .map((q, idx) => {
      const correctLabels = getAnswerLabels(q);
      const userLabels = (q.userAnswer || [])
        .map((i: number) => q.options[i]?.label || '')
        .filter(Boolean)
        .join('、');
      const reasonLabel = q.wrongReason ? WRONG_REASON_LABELS[q.wrongReason] : '未标记';
      const showAnswers = answerMode === 'show';

      let answerSection = '';
      if (showAnswers) {
        answerSection = `
          <div style="font-size: 13px; margin-top: 8px;">
            <div style="color: #10b981; margin-bottom: 4px;">正确答案：${escapeHtml(correctLabels || '无')}</div>
            <div style="color: #ef4444; margin-bottom: 4px;">你的答案：${escapeHtml(userLabels || '未作答')}</div>
            <div style="color: #8b5cf6; margin-bottom: 4px;">错误原因：${escapeHtml(reasonLabel)}</div>
            <div style="color: #6b7280;">
              <span style="font-weight: 500;">解析：</span>${escapeHtml(q.analysis || '暂无解析')}
            </div>
            ${q.note ? `<div style="color: #f59e0b; margin-top: 4px;"><span style="font-weight: 500;">笔记：</span>${escapeHtml(q.note)}</div>` : ''}
          </div>
        `;
      } else {
        answerSection = `
          <div style="font-size: 13px; margin-top: 8px;">
            <div style="color: #8b5cf6; margin-bottom: 4px;">错误原因：${escapeHtml(reasonLabel)}</div>
            ${q.note ? `<div style="color: #f59e0b; margin-top: 4px;"><span style="font-weight: 500;">笔记：</span>${escapeHtml(q.note)}</div>` : ''}
          </div>
        `;
      }

      return `
        <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 600; margin-bottom: 8px; color: #1f2937;">
            ${idx + 1}. ${escapeHtml(q.content)}
            <span style="font-weight: normal; font-size: 12px; color: #6b7280; margin-left: 8px;">
              [${QUESTION_TYPE_LABELS[q.questionType] || q.questionType}]
            </span>
          </div>
          <div style="font-size: 14px; color: #374151; margin: 8px 0;">
            ${renderOptions(q.options || [])}
          </div>
          ${answerSection}
        </div>
      `;
    })
    .join('');

  const answerSummary = answerMode === 'hide' ? buildAnswerSummaryHtml(questions) : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>错题本导出</title>
      <style>
        body { font-family: -apple-system, "Noto Sans SC", sans-serif; padding: 24px; color: #1f2937; }
        h1 { color: #8b5cf6; font-size: 22px; margin-bottom: 8px; }
        .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <h1>错题本导出</h1>
      <div class="subtitle">共 ${questions.length} 道错题 · 导出时间：${new Date().toLocaleString('zh-CN')}</div>
      ${itemsHtml}
      ${answerSummary}
    </body>
    </html>
  `;
}

async function exportAsPdf(questions: WrongBookExportItem[], answerMode: AnswerMode): Promise<void> {
  const html = buildExportHtml(questions, answerMode);

  // 创建隐藏容器
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 宽度像素约
  container.style.background = '#fff';
  container.style.padding = '24px';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`错题本_${formatDate(new Date())}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

function exportAsWord(questions: WrongBookExportItem[], answerMode: AnswerMode): void {
  const html = buildExportHtml(questions, answerMode);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `错题本_${formatDate(new Date())}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  defaultReason,
  defaultDifficulty,
}) => {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [answerMode, setAnswerMode] = useState<AnswerMode>('show');
  const [scope, setScope] = useState<'all' | 'filtered' | 'date_range'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reasonFilter, setReasonFilter] = useState<WrongReason[]>([]);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setProgress(0);
      setDone(false);
      setExporting(false);
      if (defaultReason) {
        setReasonFilter([defaultReason]);
      } else {
        setReasonFilter([]);
      }
      // 默认 scope
      if (defaultReason || defaultDifficulty) {
        setScope('filtered');
      } else {
        setScope('all');
      }
    }
    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [open, defaultReason, defaultDifficulty]);

  const toggleReason = (reason: WrongReason) => {
    setReasonFilter((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason],
    );
  };

  const handleExport = async () => {
    if (scope === 'date_range' && (!startDate || !endDate)) {
      toast.error('请选择起止日期');
      return;
    }
    try {
      setExporting(true);
      setProgress(0);

      // 模拟进度
      progressTimerRef.current = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 300);

      const res = await getWrongBookExportList({
        format,
        scope,
        reasonFilter: reasonFilter.length > 0 ? reasonFilter : undefined,
        startDate: scope === 'date_range' ? startDate : undefined,
        endDate: scope === 'date_range' ? endDate : undefined,
      });

      const questions = res.items;
      if (questions.length === 0) {
        toast.error('没有可导出的错题');
        setExporting(false);
        return;
      }

      // 前端生成文件
      if (format === 'pdf') {
        await exportAsPdf(questions, answerMode);
      } else {
        exportAsWord(questions, answerMode);
      }

      setProgress(100);
      setDone(true);
      toast.success(`成功导出 ${questions.length} 道错题`);
    } catch (error) {
      logger.error('导出错题本失败', error);
      toast.error('导出失败，请重试');
    } finally {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setExporting(false);
    }
  };

  const handleClose = () => {
    if (exporting) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            导出错题本
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {!exporting ? (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">导出格式</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat('pdf')}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      format === 'pdf'
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border/60 text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      format === 'pdf' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">PDF</div>
                      <div className="text-xs opacity-70">格式美观，适合打印</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('word')}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      format === 'word'
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border/60 text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      format === 'word' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Word</div>
                      <div className="text-xs opacity-70">可编辑，方便整理</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">答案显示方式</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAnswerMode('show')}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      answerMode === 'show'
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border/60 text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      answerMode === 'show' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">显示答案</div>
                      <div className="text-xs opacity-70">每题下方直接显示答案</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerMode('hide')}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      answerMode === 'hide'
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border/60 text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      answerMode === 'hide' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">不显示答案</div>
                      <div className="text-xs opacity-70">答案在文档末尾汇总</div>
                    </div>
                  </button>
                </div>
                {answerMode === 'hide' && (
                  <p className="text-xs text-muted-foreground">
                    正文不显示答案和解析，答案将在文档末尾统一提供
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">导出范围</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部错题</SelectItem>
                    <SelectItem value="filtered">按当前筛选结果</SelectItem>
                    <SelectItem value="date_range">按时间段</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scope === 'date_range' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">开始日期</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">结束日期</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">错误原因（可多选）</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WRONG_REASON_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`reason-${opt.value}`}
                        checked={reasonFilter.includes(opt.value)}
                        onCheckedChange={(checked) => {
                          if (checked) toggleReason(opt.value);
                          else setReasonFilter((prev) => prev.filter((r) => r !== opt.value));
                        }}
                      />
                      <label
                        htmlFor={`reason-${opt.value}`}
                        className="text-sm text-foreground cursor-pointer"
                      >
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {done ? '导出完成' : '正在生成文件...'}
                </span>
                <span className="font-medium text-primary tabular-nums">
                  {Math.min(100, Math.round(progress))}%
                </span>
              </div>
              <Progress value={Math.min(100, progress)} className="h-2" />
              {done && (
                <div className="flex items-center justify-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">导出成功</span>
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={exporting && !done}>
            {done ? '关闭' : '取消'}
          </Button>
          {!exporting && (
            <Button
              onClick={handleExport}
              className="gap-1.5 shadow-[0_4px_20px_hsl(265_85%_65%_/_0.25)]"
            >
              <Download className="h-4 w-4" />
              开始导出
            </Button>
          )}
          {exporting && !done && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              导出中...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
