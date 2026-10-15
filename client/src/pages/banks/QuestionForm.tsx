import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@client/src/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

import type {
  QuestionItem,
  QuestionOption,
  QuestionType,
  SubQuestion,
} from '@shared/api.interface';

export interface QuestionFormState {
  content: string;
  questionType: QuestionType;
  options: QuestionOption[];
  correctAnswers: number[];
  analysis: string;
  subQuestions: SubQuestion[];
  knowledgePoints: string;
  unitName: string;
}

export function useQuestionForm(initial?: QuestionItem) {
  const [content, setContent] = useState(initial?.content || '');
  const [questionType, setQuestionTypeState] = useState<QuestionType>(
    initial?.questionType || 'single',
  );
  const [options, setOptions] = useState<QuestionOption[]>(
    initial?.options?.length
      ? initial.options
      : [
          { label: 'A', text: '' },
          { label: 'B', text: '' },
          { label: 'C', text: '' },
          { label: 'D', text: '' },
        ],
  );
  const [correctAnswers, setCorrectAnswers] = useState<number[]>(
    initial?.correctAnswers || [],
  );
  const [analysis, setAnalysis] = useState(initial?.analysis || '');
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>(
    initial?.subQuestions?.length ? initial.subQuestions : [],
  );
  const [knowledgePoints, setKnowledgePoints] = useState(
    (initial as QuestionItem & { knowledgePoints?: string })?.knowledgePoints || '',
  );
  const [unitName, setUnitName] = useState(
    (initial as QuestionItem & { unitName?: string | null })?.unitName || '',
  );

  const setQuestionType = (v: QuestionType) => {
    setQuestionTypeState(v);
    if (v === 'single' && correctAnswers.length > 1) {
      setCorrectAnswers([]);
    }
    if (v === 'b1') {
      setCorrectAnswers([]);
      setSubQuestions((prev) => {
        if (prev.length > 0) return prev;
        return [
          { content: '', correctAnswer: '', analysis: '' },
          { content: '', correctAnswer: '', analysis: '' },
        ];
      });
    }
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
    const removedLabel = options[index]?.label;
    setOptions((prev) => prev.filter((_, i) => i !== index));
    setCorrectAnswers((prev) =>
      prev.filter((a) => a !== index).map((a) => (a > index ? a - 1 : a)),
    );
    // 移除选项后，子问题中引用该 label 的正确答案清空
    if (removedLabel) {
      setSubQuestions((prev) =>
        prev.map((sq) =>
          sq.correctAnswer === removedLabel ? { ...sq, correctAnswer: '' } : sq,
        ),
      );
    }
  };

  const handleCorrectToggle = (index: number) => {
    if (questionType === 'single') {
      setCorrectAnswers([index]);
    } else {
      setCorrectAnswers((prev) =>
        prev.includes(index)
          ? prev.filter((i) => i !== index)
          : [...prev, index].sort((a, b) => a - b),
      );
    }
  };

  const handleAddSubQuestion = () => {
    setSubQuestions((prev) => [
      ...prev,
      { content: '', correctAnswer: '', analysis: '' },
    ]);
  };

  const handleRemoveSubQuestion = (idx: number) => {
    setSubQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubQuestionChange = (
    idx: number,
    field: keyof SubQuestion,
    value: string,
  ) => {
    setSubQuestions((prev) =>
      prev.map((sq, i) => (i === idx ? { ...sq, [field]: value } : sq)),
    );
  };

  const validate = (): string | null => {
    if (!content.trim()) return '请输入题干';
    const validOptions = options.filter((o) => o.text.trim());
    if (validOptions.length < 2) return '至少需要 2 个有效选项';

    if (questionType === 'b1') {
      if (subQuestions.length < 1) return '至少需要 1 个子问题';
      const optionLabels = new Set(options.map((o) => o.label));
      for (let i = 0; i < subQuestions.length; i += 1) {
        const sq = subQuestions[i];
        if (!sq.content.trim()) return `第 ${i + 1} 个子问题题干不能为空`;
        if (!sq.correctAnswer) return `第 ${i + 1} 个子问题请选择正确答案`;
        if (!optionLabels.has(sq.correctAnswer)) {
          return `第 ${i + 1} 个子问题的正确答案不在备选答案中`;
        }
      }
      return null;
    }

    if (correctAnswers.length === 0) return '请选择正确答案';
    if (questionType === 'single' && correctAnswers.length !== 1) {
      return 'A1型题只能有一个正确答案';
    }
    return null;
  };

  const getPayload = (): QuestionFormState => {
    if (questionType === 'b1') {
      return {
        content: content.trim(),
        questionType,
        options,
        correctAnswers: [],
        analysis: '',
        subQuestions,
        knowledgePoints: knowledgePoints.trim(),
        unitName: unitName.trim(),
      };
    }
    return {
      content: content.trim(),
      questionType,
      options,
      correctAnswers,
      analysis: analysis.trim(),
      subQuestions: [],
      knowledgePoints: knowledgePoints.trim(),
      unitName: unitName.trim(),
    };
  };

  return {
    content,
    setContent,
    questionType,
    setQuestionType,
    options,
    correctAnswers,
    setCorrectAnswers,
    analysis,
    setAnalysis,
    subQuestions,
    handleOptionChange,
    handleAddOption,
    handleRemoveOption,
    handleCorrectToggle,
    handleAddSubQuestion,
    handleRemoveSubQuestion,
    handleSubQuestionChange,
    validate,
    getPayload,
    knowledgePoints,
    setKnowledgePoints,
    unitName,
    setUnitName,
  };
}

export function QuestionForm({
  form,
}: {
  form: ReturnType<typeof useQuestionForm>;
}) {
  const isB1 = form.questionType === 'b1';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="content">题干</Label>
        <Textarea
          id="content"
          placeholder="请输入题目内容"
          value={form.content}
          onChange={(e) => form.setContent(e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>题型</Label>
        <RadioGroup
          value={form.questionType}
          onValueChange={(v) => form.setQuestionType(v as QuestionType)}
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
            {isB1 ? '共用备选答案' : '选项（点击标记正确答案）'}
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={form.handleAddOption}
            disabled={form.options.length >= 8}
          >
            <Plus className="h-3 w-3" /> 添加选项
          </Button>
        </div>
        <div className="space-y-2">
          {form.options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {!isB1 ? (
                <div
                  className={`flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border text-sm font-medium transition-colors ${
                    form.correctAnswers.includes(idx)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                  onClick={() => form.handleCorrectToggle(idx)}
                  title="点击标记为正确答案"
                >
                  {opt.label}
                </div>
              ) : (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-medium">
                  {opt.label}
                </div>
              )}
              <Input
                value={opt.text}
                onChange={(e) => form.handleOptionChange(idx, e.target.value)}
                placeholder={`选项 ${opt.label}`}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => form.handleRemoveOption(idx)}
                disabled={form.options.length <= 2}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {!isB1 && (
          <p className="text-xs text-muted-foreground">
            提示：点击选项左侧的字母标记正确答案（多选题可选择多个）
          </p>
        )}
      </div>

      {isB1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>子问题</Label>
            <Button variant="ghost" size="sm" onClick={form.handleAddSubQuestion}>
              <Plus className="h-3 w-3" /> 添加子问题
            </Button>
          </div>
          <div className="space-y-3">
            {form.subQuestions.map((sq, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {idx + 1}. 子问题
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => form.handleRemoveSubQuestion(idx)}
                    disabled={form.subQuestions.length <= 1}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  placeholder="子问题题干"
                  value={sq.content}
                  onChange={(e) =>
                    form.handleSubQuestionChange(idx, 'content', e.target.value)
                  }
                  rows={2}
                />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">正确答案</Label>
                  <Select
                    value={sq.correctAnswer}
                    onValueChange={(v) =>
                      form.handleSubQuestionChange(idx, 'correctAnswer', v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择正确答案" />
                    </SelectTrigger>
                    <SelectContent>
                      {form.options.map((opt) => (
                        <SelectItem key={opt.label} value={opt.label}>
                          {opt.label}. {opt.text || `（选项 ${opt.label}）`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">解析（选填）</Label>
                  <Textarea
                    placeholder="子问题解析"
                    value={sq.analysis}
                    onChange={(e) =>
                      form.handleSubQuestionChange(idx, 'analysis', e.target.value)
                    }
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isB1 && (
        <div className="space-y-2">
          <Label htmlFor="analysis">答案解析</Label>
          <Textarea
            id="analysis"
            placeholder="请输入答案解析（选填）"
            value={form.analysis}
            onChange={(e) => form.setAnalysis(e.target.value)}
            rows={2}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="knowledge-points">知识点</Label>
          <Input
            id="knowledge-points"
            placeholder="如：生理学/呼吸"
            value={form.knowledgePoints}
            onChange={(e) => form.setKnowledgePoints(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit-name">所属单元/章节</Label>
          <Input
            id="unit-name"
            placeholder="如：第一单元"
            value={form.unitName}
            onChange={(e) => form.setUnitName(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
