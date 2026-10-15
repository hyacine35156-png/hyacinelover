import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

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
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@client/src/components/ui/radio-group';
import { Switch } from '@client/src/components/ui/switch';

import { questionBankApi } from '@client/src/api';
import type {
  QuestionBankItem,
  QuestionType,
  QuestionOption,
  SubQuestion,
} from '@shared/api.interface';

const AddQuestionDialog = ({
  banks,
  onSuccess,
}: {
  banks: QuestionBankItem[];
  onSuccess: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [content, setContent] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('single');
  const [options, setOptions] = useState<QuestionOption[]>([
    { label: 'A', text: '' },
    { label: 'B', text: '' },
    { label: 'C', text: '' },
    { label: 'D', text: '' },
  ]);
  const [correctAnswers, setCorrectAnswers] = useState<number[]>([]);
  const [analysis, setAnalysis] = useState('');
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([
    { content: '', correctAnswer: '', analysis: '' },
    { content: '', correctAnswer: '', analysis: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [showNewBank, setShowNewBank] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankIsPublic, setNewBankIsPublic] = useState(false);

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setOpen(false);
      resetForm();
    } else {
      setOpen(true);
      if (banks.length > 0) {
        setSelectedBankId(banks[0].id);
      } else {
        setShowNewBank(true);
      }
    }
  };

  const resetForm = () => {
    setContent('');
    setQuestionType('single');
    setOptions([
      { label: 'A', text: '' },
      { label: 'B', text: '' },
      { label: 'C', text: '' },
      { label: 'D', text: '' },
    ]);
    setCorrectAnswers([]);
    setAnalysis('');
    setSubQuestions([
      { content: '', correctAnswer: '', analysis: '' },
      { content: '', correctAnswer: '', analysis: '' },
    ]);
    setSubmitting(false);
    setShowNewBank(false);
    setNewBankName('');
    setNewBankIsPublic(false);
  };

  const handleOptionChange = (index: number, text: string) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, text } : opt)),
    );
  };

  const handleAddOption = () => {
    if (options.length >= 8) return;
    const nextLabel = String.fromCharCode(65 + options.length);
    setOptions((prev) => [...prev, { label: nextLabel, text: '' }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
    setCorrectAnswers((prev) =>
      prev.filter((a) => a !== index).map((a) => (a > index ? a - 1 : a)),
    );
  };

  const handleCorrectToggle = (index: number) => {
    if (questionType === 'single') {
      setCorrectAnswers([index]);
    } else if (questionType === 'multiple') {
      setCorrectAnswers((prev) =>
        prev.includes(index)
          ? prev.filter((i) => i !== index)
          : [...prev, index].sort((a, b) => a - b),
      );
    }
  };

  const handleSubQuestionChange = (
    index: number,
    field: keyof SubQuestion,
    value: string,
  ) => {
    setSubQuestions((prev) =>
      prev.map((sq, i) => (i === index ? { ...sq, [field]: value } : sq)),
    );
  };

  const handleAddSubQuestion = () => {
    if (subQuestions.length >= 10) return;
    setSubQuestions((prev) => [...prev, { content: '', correctAnswer: '', analysis: '' }]);
  };

  const handleRemoveSubQuestion = (index: number) => {
    if (subQuestions.length <= 2) return;
    setSubQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedBankId && !showNewBank) {
      toast.error('请选择题集');
      return;
    }
    if (!content.trim()) {
      toast.error('请输入题干');
      return;
    }
    const validOptions = options.filter((o) => o.text.trim());
    if (validOptions.length < 2) {
      toast.error('至少需要 2 个有效选项');
      return;
    }
    if (questionType !== 'b1' && correctAnswers.length === 0) {
      toast.error('请选择正确答案');
      return;
    }
    if (questionType === 'single' && correctAnswers.length !== 1) {
      toast.error('A1型题只能有一个正确答案');
      return;
    }
    if (questionType === 'b1') {
      const validSubs = subQuestions.filter(
        (sq) => sq.content.trim() && sq.correctAnswer.trim(),
      );
      if (validSubs.length < 2) {
        toast.error('B1型题至少需要 2 个有效子问题（含题干和正确答案）');
        return;
      }
    }

    try {
      setSubmitting(true);

      let bankId = selectedBankId;
      if (showNewBank && newBankName.trim()) {
        const bank = await questionBankApi.createBank({
          name: newBankName.trim(),
          isPublic: newBankIsPublic,
        });
        bankId = bank.id;
      }

       const payload = {
         content: content.trim(),
         questionType,
         options,
         correctAnswers,
         analysis: analysis.trim(),
         subQuestions: questionType === 'b1' ? subQuestions : undefined,
       };
       await questionBankApi.addQuestion(bankId, payload);

      toast.success('添加成功');
      onSuccess();
      setOpen(false);
      resetForm();
    } catch (error) {
      logger.error('添加题目失败', error);
      toast.error('添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4" />
          手动录入
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>手动录入题目</DialogTitle>
          <DialogDescription>填写题目信息，选项至少 2 个</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            {banks.length > 0 && !showNewBank ? (
              <div className="space-y-2">
                <Label>所属题集</Label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewBank(true)}
                  className="text-xs text-primary hover:underline"
                >
                   + 新建题集
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="new-bank">题集名称</Label>
                <Input
                  id="new-bank"
                  placeholder="请输入新题集名称"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                />
                <div className="flex items-center justify-between pt-2">
                  <div>
                     <p className="text-sm font-medium text-foreground">公开题集</p>
                     <p className="text-xs text-muted-foreground">
                       公开后所有用户都能看到和复制你的题集
                     </p>
                  </div>
                  <Switch
                    checked={newBankIsPublic}
                    onCheckedChange={setNewBankIsPublic}
                  />
                </div>
                {banks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNewBank(false)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                     选择已有题集
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="content">题干</Label>
              <Textarea
                id="content"
                placeholder="请输入题目内容"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>题型</Label>
              <RadioGroup
                value={questionType}
                onValueChange={(v) => {
                  setQuestionType(v as QuestionType);
                  setCorrectAnswers([]);
                }}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="single" id="type-single" />
                   <label htmlFor="type-single" className="text-sm">
                     A1型题（单项选择题）
                   </label>
                </div>
                 <div className="flex items-center gap-2">
                   <RadioGroupItem value="multiple" id="type-multiple" />
                    <label htmlFor="type-multiple" className="text-sm">
                      X型题（多选题）
                    </label>
                 </div>
                 <div className="flex items-center gap-2">
                   <RadioGroupItem value="b1" id="type-b1" />
                    <label htmlFor="type-b1" className="text-sm">
                      B1型题（共用选项题）
                    </label>
                 </div>
              </RadioGroup>
           </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  {questionType === 'b1' ? '共用备选答案' : '选项（点击标记正确答案）'}
                </Label>
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={handleAddOption}
                 disabled={options.length >= 8}
               >
                 <Plus className="h-3 w-3" /> 添加选项
               </Button>
             </div>
             <div className="space-y-2">
               {options.map((opt, idx) => (
                 <div key={idx} className="flex items-center gap-2">
                   <div
                     className={`flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border text-sm font-medium transition-colors ${
                       correctAnswers.includes(idx)
                         ? 'border-primary bg-primary text-primary-foreground'
                         : 'border-border bg-card hover:border-primary/50'
                     }`}
                      onClick={() => questionType !== 'b1' && handleCorrectToggle(idx)}
                      title={questionType === 'b1' ? '' : '点击标记为正确答案'}
                   >
                     {opt.label}
                   </div>
                   <Input
                     value={opt.text}
                     onChange={(e) => handleOptionChange(idx, e.target.value)}
                     placeholder={`选项 ${opt.label}`}
                     className="flex-1"
                   />
                   <Button
                     variant="ghost"
                     size="icon"
                     onClick={() => handleRemoveOption(idx)}
                     disabled={options.length <= 2}
                     className="h-8 w-8 text-muted-foreground hover:text-destructive"
                   >
                     <Trash2 className="h-4 w-4" />
                   </Button>
                 </div>
               ))}
             </div>
              {questionType !== 'b1' && (
                <p className="text-xs text-muted-foreground">
                  提示：点击选项左侧的字母标记正确答案（
                  {questionType === 'single' ? 'A1型题' : 'X型题'}
                  ）
                </p>
              )}
            </div>

           {questionType === 'b1' && (
             <div className="space-y-2">
               <div className="flex items-center justify-between">
                 <Label>子问题</Label>
                 <Button
                   variant="ghost"
                   size="sm"
                   onClick={handleAddSubQuestion}
                   disabled={subQuestions.length >= 10}
                 >
                   <Plus className="h-3 w-3" /> 添加子问题
                 </Button>
               </div>
               <div className="space-y-3">
                 {subQuestions.map((sq, idx) => (
                   <div
                     key={idx}
                     className="space-y-2 rounded-md border border-border bg-muted/20 p-3"
                   >
                     <div className="flex items-center justify-between">
                       <span className="text-xs font-medium text-foreground">
                         子问题 {idx + 1}
                       </span>
                       <Button
                         variant="ghost"
                         size="icon"
                         onClick={() => handleRemoveSubQuestion(idx)}
                         disabled={subQuestions.length <= 2}
                         className="h-6 w-6 text-muted-foreground hover:text-destructive"
                       >
                         <Trash2 className="h-3.5 w-3.5" />
                       </Button>
                     </div>
                     <Textarea
                       placeholder="子问题题干"
                       value={sq.content}
                       onChange={(e) => handleSubQuestionChange(idx, 'content', e.target.value)}
                       rows={2}
                     />
                     <div className="flex items-center gap-2">
                       <Label className="w-16 shrink-0 text-xs text-muted-foreground">
                         正确答案
                       </Label>
                       <Input
                         placeholder="如 A、B、C"
                         value={sq.correctAnswer}
                         onChange={(e) =>
                           handleSubQuestionChange(idx, 'correctAnswer', e.target.value)
                         }
                         className="flex-1"
                       />
                     </div>
                     <div className="flex items-start gap-2">
                       <Label className="w-16 shrink-0 pt-2 text-xs text-muted-foreground">
                         解析
                       </Label>
                       <Textarea
                         placeholder="子问题解析（选填）"
                         value={sq.analysis}
                         onChange={(e) => handleSubQuestionChange(idx, 'analysis', e.target.value)}
                         rows={2}
                         className="flex-1"
                       />
                     </div>
                   </div>
                 ))}
               </div>
               <p className="text-xs text-muted-foreground">
                  提示：B1型题的每个子问题共用上方的备选答案，答案填对应选项字母
               </p>
             </div>
           )}

           <div className="space-y-2">
             <Label htmlFor="analysis">解析</Label>
            <Textarea
              id="analysis"
              placeholder="答案解析（选填）"
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中
              </>
            ) : (
              '保存题目'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddQuestionDialog;
