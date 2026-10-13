import { useState, useRef } from 'react';
import {
  Upload,
  Loader2,
  FileText,
  AlertTriangle,
  ChevronRight,
  Download,
  HelpCircle,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { extractErrorMessage } from '@client/src/utils/error';
import { toast } from 'sonner';
import type {
  WordPreviewResponse,
  ParsedQuestionItem,
  QuestionType,
} from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Progress } from '@client/src/components/ui/progress';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Switch } from '@client/src/components/ui/switch';
import { Badge } from '@client/src/components/ui/badge';
import { questionBankApi } from '@client/src/api';
import JsonFormatDialog from './JsonFormatDialog';

type Step = 'upload' | 'preview' | 'result';
type ImportResult = {
  successCount: number;
  failCount: number;
  failures: { row: number; reason: string }[];
  singleCount?: number;
  multipleCount?: number;
  b1Count?: number;
  warnings?: string[];
};

const WORD_TEMPLATE =
  '【A1型题（单选题）】\n1. 题干内容\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案：A\n解析：答案解析内容\n\n【X型题（多选题）】\n2. 题干内容\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案：ABC\n解析：答案解析内容\n\n【B1型题（配伍题）】\n（3-4题共用备选答案）\nA. 共用选项A\nB. 共用选项B\nC. 共用选项C\nD. 共用选项D\n3. 子问题1题干\n答案：A\n4. 子问题2题干\n答案：B\n';

const typeLabelMap: Record<QuestionType, string> = {
  single: '单选',
  multiple: '多选',
  b1: 'B1型',
};

const isWordFile = (f: File | null): boolean =>
  !!f && /\.(docx|doc)$/i.test(f.name);

const IMPORT_MAX_QUESTIONS = 2000;
const IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024;

const getConfidenceInfo = (c?: number) => {
  if (c !== undefined && c >= 0.8)
    return { label: '置信度高', cls: 'text-[hsl(152_60%_40%)]', warn: false };
  if (c === undefined || c >= 0.6)
    return { label: '置信度中', cls: 'text-muted-foreground', warn: false };
  return { label: '低置信度，请核对', cls: 'text-[hsl(25_95%_53%)]', warn: true };
};

const getAnswerLetters = (q: ParsedQuestionItem): string => {
  if (q.questionType === 'b1')
    return q.subQuestions.map((sq) => sq.correctAnswer).join(', ');
  return q.correctAnswers
    .sort((a, b) => a - b)
    .map((i) => String.fromCharCode(65 + i))
    .join('');
};

const TITLE: Record<Step, string> = {
  upload: '导入题集',
  preview: '预览确认',
  result: '导入结果',
};
const DESC: Record<Step, string> = {
  upload: '题集上传支持 json/excel/csv/word 格式，单次最多 2000 道题，文件大小不超过 20MB',
  preview: '请核对识别结果，确认无误后导入',
  result: '导入完成，查看结果详情',
};

const ImportDialog = ({
  onSuccess,
  triggerVariant = 'outline',
}: {
  onSuccess: () => void;
  triggerVariant?: 'default' | 'outline';
}) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [bankName, setBankName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState<Step>('upload');
  const [previewData, setPreviewData] = useState<WordPreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAll = () => {
    setFile(null);
    setBankName('');
    setProgress(0);
    setImportResult(null);
    setPreviewData(null);
    setIsPublic(false);
    setStep('upload');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.files?.[0];
    if (!s) return;
    if (s.size > IMPORT_MAX_FILE_SIZE) {
      toast.error(`文件大小不能超过 20MB（当前 ${(s.size / 1024 / 1024).toFixed(2)}MB）`);
      return;
    }
    setFile(s);
    if (!bankName) setBankName(s.name.replace(/\.(xlsx|xls|csv|json|docx|doc)$/i, ''));
    setPreviewData(null);
    setImportResult(null);
    setStep('upload');
  };

  const handleClose = () => {
    if (!uploading) {
      setOpen(false);
      resetAll();
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([WORD_TEMPLATE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'word-题目模板.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    if (!file || !bankName.trim()) return toast.error('请填写题集名称并选择文件');
    try {
      setUploading(true);
      setProgress(0);
      setErrorMsg('');
      const res = await questionBankApi.importBank(bankName.trim(), file, setProgress, isPublic);
      setImportResult({
        successCount: res.successCount,
        failCount: res.failCount,
        failures: res.failures,
        singleCount: res.singleCount,
        multipleCount: res.multipleCount,
        b1Count: res.b1Count,
        warnings: res.warnings,
      });
      setStep('result');
      if (res.successCount > 0) {
        toast.success(`成功导入 ${res.successCount} 道题`);
        onSuccess();
      } else toast.error('导入失败，请检查文件格式');
    } catch (err) {
      logger.error('导入失败', err);
      const msg = extractErrorMessage(err);
      setErrorMsg(msg);
      toast.error(`导入失败：${msg}`);
    } finally { setUploading(false); }
  };

  const doPreview = async () => {
    if (!file) return toast.error('请选择文件');
    try {
      setUploading(true);
      setProgress(0);
      setErrorMsg('');
      const res = await questionBankApi.previewWordImport(file, setProgress);
      setPreviewData(res);
      setStep('preview');
    } catch (err) {
      logger.error('Word 预览解析失败', err);
      const msg = extractErrorMessage(err);
      setErrorMsg(msg);
      toast.error(`解析失败：${msg}`);
    } finally { setUploading(false); }
  };

  const handleStart = () => (isWordFile(file) ? doPreview() : doImport());

  const handleResetFile = () => {
    setStep('upload');
    setPreviewData(null);
    setFile(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const renderUploadStep = () => (
    <div className="space-y-5 py-2">
      <div className="space-y-2">
        <Label htmlFor="bank-name">题集名称</Label>
        <Input
          id="bank-name"
          placeholder="请输入题集名称"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className="transition-all duration-200 focus-visible:ring-primary/25 focus-visible:border-primary/40"
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">公开题集</p>
          <p className="text-xs text-muted-foreground">
            公开后所有用户都能看到和复制你的题集
          </p>
        </div>
        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
      </div>
      <div className="space-y-2">
        <Label>选择文件</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json,.docx,.doc"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-gradient-to-b from-card to-muted/20 px-4 py-10 text-center transition-all duration-300 hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110">
            <Upload className="h-6 w-6" />
          </div>
          {file ? (
            <div>
              <p className="text-sm font-semibold text-foreground">{file.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {(file.size / 1024).toFixed(1)} KB · 点击重新选择
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground">点击选择文件</p>
              <p className="mt-0.5 text-xs text-muted-foreground">题集上传支持特定格式的json格式</p>
            </div>
          )}
        </div>
       </div>
       <p className="text-xs text-muted-foreground">
         题集名称和内容请勿包含「刷题」「真题」「作弊」等敏感词，仅供个人学习自测使用
       </p>
       <div className="flex items-center justify-center gap-4 text-center">
         <button
           type="button"
           onClick={handleDownloadTemplate}
           className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
         >
           <Download className="h-3.5 w-3.5" />
           下载 Word 题目模板
         </button>
         <span className="text-xs text-border">·</span>
         <button
           type="button"
           onClick={() => setShowFormatDialog(true)}
           className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
         >
           <HelpCircle className="h-3.5 w-3.5" />
           JSON 格式说明
         </button>
       </div>
      {errorMsg && (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">导入失败</p>
          <p className="mt-1 break-words text-xs opacity-90">{errorMsg}</p>
        </div>
      )}
      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{isWordFile(file) ? '解析中...' : '导入中...'}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
    </div>
  );

  const renderPreviewStep = () => {
    if (!previewData) return null;
    const stats = [
      { label: '单选', value: previewData.singleCount, cls: '' },
      { label: '多选', value: previewData.multipleCount, cls: '' },
      { label: 'B1型', value: previewData.b1Count, cls: '' },
      {
        label: '低置信度',
        value: previewData.lowConfidenceCount,
        cls: 'text-[hsl(38_90%_50%)]',
      },
    ];
    return (
      <div className="space-y-4 py-2">
        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-pink-400/5 p-5 shadow-sm">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">识别题目总数</p>
            <p className="mt-1.5 text-4xl font-bold tabular-nums gradient-primary-text">
              {previewData.totalCount}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg bg-muted py-2">
                <p className={`text-lg font-semibold tabular-nums ${s.cls}`}>{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
          {previewData.questions.map((q, idx) => {
            const conf = getConfidenceInfo(q.confidence);
            const ans = getAnswerLetters(q);
            const visible = q.options.slice(0, 3);
            const hidden = q.options.length - 3;
            return (
              <div
                key={idx}
                className="rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-all duration-200 hover:border-border hover:shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground tabular-nums">
                      {idx + 1}.
                    </span>
                    <Badge variant="secondary" className="h-5 px-2 text-[11px] font-normal">
                      {typeLabelMap[q.questionType]}
                    </Badge>
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${conf.cls}`}>
                    {conf.warn && <AlertTriangle className="h-3 w-3" />}
                    <span>{conf.label}</span>
                  </div>
                </div>
                <p className="mb-2 line-clamp-2 text-sm text-foreground">
                  {q.content || '（题干为空）'}
                </p>
                <div className="mb-2 space-y-1 text-xs text-muted-foreground">
                  {visible.map((opt, i) => (
                    <div key={i} className="truncate">
                      {opt.label}. {opt.text}
                    </div>
                  ))}
                  {hidden > 0 && (
                    <div className="text-muted-foreground/70">共 {q.options.length} 个选项</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  答案：<span className="font-medium text-foreground">{ans}</span>
                </div>
                {q.warning && (
                  <div className="mt-2 text-xs text-destructive">⚠ {q.warning}</div>
                )}
              </div>
            );
          })}
        </div>
        {previewData.failures.length > 0 && (
          <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">解析失败 {previewData.failures.length} 道</p>
            <div className="mt-1 space-y-0.5">
              {previewData.failures.slice(0, 3).map((f, idx) => (
                <div key={idx}>第 {f.index + 1} 题：{f.reason}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResultStep = () => {
    if (!importResult) return null;
    const hasTypes =
      importResult.singleCount !== undefined ||
      importResult.multipleCount !== undefined ||
      importResult.b1Count !== undefined;
    const typeStats = [
      { label: '单选题', value: importResult.singleCount ?? 0 },
      { label: '多选题', value: importResult.multipleCount ?? 0 },
      { label: 'B1型题', value: importResult.b1Count ?? 0 },
    ];
    return (
      <div className="space-y-4 py-2">
        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-pink-400/5 p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">导入结果</p>
          <div className="mt-2 flex items-center justify-center gap-10">
            <div>
              <p className="text-3xl font-bold text-emerald-600 tabular-nums">
                {importResult.successCount}
              </p>
              <p className="text-xs text-muted-foreground">成功</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-destructive tabular-nums">{importResult.failCount}</p>
              <p className="text-xs text-muted-foreground">失败</p>
            </div>
          </div>
        </div>
        {hasTypes && (
          <div className="grid grid-cols-3 gap-3 text-center">
            {typeStats.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                <p className="text-lg font-semibold tabular-nums text-foreground">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        )}
        {importResult.failures.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-lg bg-muted/50 p-3 text-sm">
            {importResult.failures.slice(0, 5).map((f, idx) => (
              <div key={idx} className="text-muted-foreground text-xs">
                第 {f.row} 行：{f.reason}
              </div>
            ))}
            {importResult.failures.length > 5 && (
              <div className="text-muted-foreground text-xs">
                ...还有 {importResult.failures.length - 5} 条
              </div>
            )}
          </div>
        )}
        {importResult.warnings && importResult.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">题集名称包含敏感词</p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-amber-700">
                  {importResult.warnings.map((w: string, idx: number) => (
                    <li key={idx}>· {w}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-600">
                  建议修改题集名称后使用
                </p>
              </div>
            </div>
          </div>
        )}
       </div>
    );
  };

  const renderFooter = () => {
    if (step === 'result')
      return (
        <Button variant="outline" onClick={handleClose} disabled={uploading}>
          关闭
        </Button>
      );
    if (step === 'preview')
      return (
        <>
          <Button variant="outline" onClick={handleResetFile} disabled={uploading}>
            重新选择文件
          </Button>
          <Button onClick={doImport} disabled={uploading}>
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />导入中</>
            ) : (
              <>确认导入<ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        </>
      );
    return (
      <>
        <Button variant="outline" onClick={handleClose} disabled={uploading}>取消</Button>
          <Button onClick={handleStart} disabled={!file || !bankName.trim() || uploading}
            style={{
              background:
                'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
              boxShadow: '0 2px 8px -2px hsl(265 85% 65% / 0.3)',
            }}
          >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isWordFile(file) ? '解析中' : '导入中'}
            </>
          ) : isWordFile(file) ? (
            <>
              <FileText className="h-4 w-4" />
              开始解析
              <ChevronRight className="h-4 w-4" />
            </>
          ) : (
            '开始导入'
          )}
        </Button>
      </>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <Upload className="h-4 w-4" />
          导入文件
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
           <DialogTitle>{TITLE[step]}</DialogTitle>
           <DialogDescription>{DESC[step]}</DialogDescription>
        </DialogHeader>
        <DialogBody>
         {step === 'upload' && renderUploadStep()}
         {step === 'preview' && renderPreviewStep()}
         {step === 'result' && renderResultStep()}
        </DialogBody>
          <DialogFooter>{renderFooter()}</DialogFooter>
       </DialogContent>
      </Dialog>

      <JsonFormatDialog open={showFormatDialog} onOpenChange={setShowFormatDialog} />
    </>
 );
};

export default ImportDialog;
