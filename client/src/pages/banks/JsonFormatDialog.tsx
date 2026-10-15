import { useState } from 'react';
import { Download, X } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@client/src/components/ui/dialog';

const JSON_TEMPLATE_SINGLE = [
  {
    content: '题干内容',
    options: [
      { label: 'A', text: '选项A内容' },
      { label: 'B', text: '选项B内容' },
      { label: 'C', text: '选项C内容' },
      { label: 'D', text: '选项D内容' },
    ],
    correctAnswers: [0],
    questionType: 'single',
    analysis: '解析内容（可选）',
  },
];

const JSON_TEMPLATE_MULTIPLE = [
  {
    content: '题干内容',
    options: [
      { label: 'A', text: '选项A内容' },
      { label: 'B', text: '选项B内容' },
      { label: 'C', text: '选项C内容' },
      { label: 'D', text: '选项D内容' },
    ],
    correctAnswers: [0, 1, 2],
    questionType: 'multiple',
    analysis: '解析内容（可选）',
  },
];

const JSON_TEMPLATE_B1 = [
  {
    content: '（1-2题共用备选答案）',
    options: [
      { label: 'A', text: '共用选项A' },
      { label: 'B', text: '共用选项B' },
      { label: 'C', text: '共用选项C' },
      { label: 'D', text: '共用选项D' },
    ],
    questionType: 'b1',
    correctAnswers: [],
    analysis: '',
    subQuestions: [
      { content: '子问题1题干', correctAnswer: 'A', analysis: '解析1' },
      { content: '子问题2题干', correctAnswer: 'B', analysis: '解析2' },
    ],
  },
];

const JSON_TEMPLATE_FULL = [
  ...JSON_TEMPLATE_SINGLE,
  ...JSON_TEMPLATE_MULTIPLE,
  ...JSON_TEMPLATE_B1,
];

type JsonFormatTab = 'single' | 'multiple' | 'b1' | 'fields';

const JSON_FORMAT_TABS: { key: JsonFormatTab; label: string }[] = [
  { key: 'single', label: '单选题' },
  { key: 'multiple', label: '多选题' },
  { key: 'b1', label: 'B1配伍题' },
  { key: 'fields', label: '字段说明' },
];

const FIELD_ROWS = [
  { field: 'content', type: 'string', required: '是', desc: '题干内容' },
  { field: 'options', type: 'array', required: '是', desc: '选项数组，每个元素含 label 和 text' },
  { field: 'correctAnswers', type: 'array', required: '单选/多选必填', desc: '正确答案的选项索引数组（0-based，0=A, 1=B...）' },
  { field: 'questionType', type: 'string', required: '是', desc: '题型：single / multiple / b1' },
  { field: 'analysis', type: 'string', required: '否', desc: '解析内容' },
  { field: 'subQuestions', type: 'array', required: 'b1 型必填', desc: '子问题数组，每个含 content / correctAnswer / analysis' },
];

const getJsonExample = (tab: JsonFormatTab): string => {
  switch (tab) {
    case 'single':
      return JSON.stringify(JSON_TEMPLATE_SINGLE, null, 2);
    case 'multiple':
      return JSON.stringify(JSON_TEMPLATE_MULTIPLE, null, 2);
    case 'b1':
      return JSON.stringify(JSON_TEMPLATE_B1, null, 2);
    default:
      return '';
  }
};

const TAB_DESCRIPTIONS: Record<Exclude<JsonFormatTab, 'fields'>, string> = {
  single: '说明：correctAnswers 是选项索引数组，0 表示 A，1 表示 B；单选题只有一个正确答案。',
  multiple: '说明：多选题 correctAnswers 可以包含多个索引。',
  b1: '说明：B1 型题主记录的 correctAnswers 为空数组，正确答案在每个 subQuestion 的 correctAnswer 字段中（字母格式）。',
};

const TAB_TITLES: Record<Exclude<JsonFormatTab, 'fields'>, string> = {
  single: 'A1 型题（单选题）格式示例',
  multiple: 'X 型题（多选题）格式示例',
  b1: 'B1 型题（配伍题）格式示例',
};

const JsonFormatDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [tab, setTab] = useState<JsonFormatTab>('single');

  const handleDownload = () => {
    const jsonStr = JSON.stringify(JSON_TEMPLATE_FULL, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '题集导入模板.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader className="pr-14">
          <DialogTitle>JSON 导入格式说明</DialogTitle>
          <DialogDescription>
            JSON 文件应为题目数组，支持单选题、多选题、B1 配伍题三种格式
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b border-border/60 px-5 sm:px-6">
          {JSON_FORMAT_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2 text-sm font-medium transition-all duration-200 ${
                tab === t.key
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-primary to-pink-400" />
              )}
            </button>
          ))}
        </div>

        <DialogBody>
          {tab === 'fields' ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground">字段</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground">类型</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground">必填</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground">说明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {FIELD_ROWS.map((row) => (
                      <tr key={row.field} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.field}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.type}</td>
                        <td className="px-4 py-2.5 text-destructive text-xs">{row.required}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-pink-400/[0.04] p-4 space-y-2">
                <p className="text-sm font-semibold text-accent-foreground">注意事项</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                  <li>文件必须是标准 JSON 格式，不能有注释</li>
                  <li>选项 label 建议用大写字母 A/B/C/D/E</li>
                  <li>correctAnswers 是数字索引，不是字母</li>
                  <li>B1 型题的 subQuestions.correctAnswer 是字母，不是数字索引</li>
                  <li>单文件最多 2000 道题，文件大小不超过 20MB</li>
                  <li>B1 型题主记录的 correctAnswers 为空数组</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">{TAB_TITLES[tab]}</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/60 p-4 text-xs leading-relaxed shadow-inner">
                <code className="font-mono text-foreground">{getJsonExample(tab)}</code>
              </pre>
              <p className="text-xs text-muted-foreground leading-relaxed">{TAB_DESCRIPTIONS[tab]}</p>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="!justify-between">
          <p className="text-xs text-muted-foreground">
            共支持 3 种题型，点击上方 Tab 切换查看
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
            <Button onClick={handleDownload}
              style={{
                background:
                  'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
                boxShadow: '0 2px 8px -2px hsl(265 85% 65% / 0.3)',
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              下载 JSON 模板
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JsonFormatDialog;
