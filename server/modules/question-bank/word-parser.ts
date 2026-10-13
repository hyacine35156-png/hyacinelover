import mammoth from 'mammoth';
import { BadRequestException } from '@nestjs/common';
import type { QuestionOption, SubQuestion, ParsedQuestionItem } from '@shared/api.interface';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

interface ParseContext {
  lines: string[];
  index: number;
}

interface RawQuestion {
  index: number;
  content: string;
  options: QuestionOption[];
  answerText: string;
  analysis: string;
  questionType: 'single' | 'multiple' | 'b1';
  subQuestions: RawSubQuestion[];
  b1SharedOptions: QuestionOption[];
  confidence: number;
  warning?: string;
}

interface RawSubQuestion {
  content: string;
  correctAnswer: string;
  analysis: string;
}

export async function parseWordToText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (err) {
    throw new BadRequestException(
      `Word 文档解析失败：${err instanceof Error ? err.message : '未知错误'}`,
    );
  }
}

function normalizeLines(rawText: string): string[] {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\u00a0/g, ' ').trim())
    .filter((line) => line.length > 0);
}

function isQuestionNumberPrefix(line: string): number | null {
  const patterns = [
    /^(\d+)[\.．、]\s*/,
    /^[（(](\d+)[)）]\s*/,
    /^(\d+)\s+/,
  ];
  for (const p of patterns) {
    const m = line.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function isOptionPrefix(line: string): { label: string; text: string } | null {
  const m = line.match(/^([A-Ja-j])[\.．、)\s]\s*(.*)$/);
  if (m) {
    return { label: m[1].toUpperCase(), text: m[2].trim() };
  }
  return null;
}

function extractAnswerFromLine(line: string): string | null {
  const patterns = [
    /^(?:答案|正确答案|参考答案|【答案】|〖答案〗|\[答案\])[：:\s]*(.+)$/i,
    /^(?:解析|答案解析|【解析】|〖解析〗|\[解析\])[：:\s]*(.+)$/i,
  ];
  for (const p of patterns) {
    const m = line.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function isAnswerLine(line: string): boolean {
  return /^(?:答案|正确答案|参考答案|【答案】|〖答案〗|\[答案\])[：:]/i.test(line);
}

function isAnalysisLine(line: string): boolean {
  return /^(?:解析|答案解析|【解析】|〖解析〗|\[解析\])[：:]/i.test(line);
}

function isB1SharedHeader(line: string): boolean {
  return /(?:共用备选答案|共用选项|配伍题|B1型题|Ｂ１型题|b1型)/i.test(line);
}

function extractAnswerLetters(text: string): string[] {
  const clean = text.replace(/[\s，、,；;]/g, '').toUpperCase();
  const letters: string[] = [];
  for (const ch of clean) {
    if (/^[A-J]$/.test(ch)) {
      letters.push(ch);
    }
  }
  return letters;
}

function letterToIndex(letter: string, options: QuestionOption[]): number {
  const idx = options.findIndex((o) => o.label.toUpperCase() === letter.toUpperCase());
  return idx;
}

function collectOptionsFromLines(
  lines: string[],
  start: number,
): { options: QuestionOption[]; endIndex: number } {
  const options: QuestionOption[] = [];
  let i = start;
  while (i < lines.length) {
    const opt = isOptionPrefix(lines[i]);
    if (opt) {
      let text = opt.text;
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (
          isOptionPrefix(nextLine) ||
          isQuestionNumberPrefix(nextLine) !== null ||
          isAnswerLine(nextLine) ||
          isAnalysisLine(nextLine) ||
          isB1SharedHeader(nextLine)
        ) {
          break;
        }
        text += nextLine;
        j += 1;
      }
      options.push({ label: opt.label, text });
      i = j;
    } else {
      break;
    }
    if (options.length >= 10) break;
  }
  return { options, endIndex: i };
}

function extractAnswerAtEnd(lines: string[]): Map<number, string> {
  const answerMap = new Map<number, string>();
  const answerSectionStart = findAnswerSection(lines);
  if (answerSectionStart < 0) return answerMap;

  let sectionText = '';
  for (let i = answerSectionStart; i < lines.length; i += 1) {
    sectionText += lines[i] + ' ';
  }

  const patterns = [
    /(\d+)[\.．、:：]\s*([A-Ja-j]+)/g,
    /[（(](\d+)[)）]\s*([A-Ja-j]+)/g,
    /(\d+)\s+([A-Ja-j]+)/g,
  ];

  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(sectionText)) !== null) {
      const qNum = parseInt(m[1], 10);
      const ans = m[2].toUpperCase();
      if (!answerMap.has(qNum)) {
        answerMap.set(qNum, ans);
      }
    }
  }

  return answerMap;
}

function findAnswerSection(lines: string[]): number {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (
      /^(?:答案|参考答案|答案解析|标准答案)\s*[：:]?\s*$/.test(line) ||
      /^【答案】/.test(line) ||
      /^—+答案—+$/i.test(line) ||
      /^[-—]+\s*答案\s*[-—]+$/i.test(line)
    ) {
      return i;
    }
  }
  return -1;
}

function parseB1Group(
  lines: string[],
  startIdx: number,
  baseIndex: number,
): { group: RawQuestion; endIndex: number } {
  let i = startIdx;
  const headerLine = lines[i];
  i += 1;

  const { options: sharedOptions, endIndex: optEnd } = collectOptionsFromLines(lines, i);
  i = optEnd;

  const subQuestions: RawSubQuestion[] = [];
  let confidence = 0.6;

  while (i < lines.length) {
    const line = lines[i];
    const qNum = isQuestionNumberPrefix(line);

    if (qNum !== null) {
      let subContent = line.replace(/^[\d\.．、（）()\s]+/, '').trim();
      let subAnswer = '';
      let subAnalysis = '';
      let j = i + 1;

      while (j < lines.length) {
        const nextLine = lines[j];
        if (
          isQuestionNumberPrefix(nextLine) !== null ||
          isB1SharedHeader(nextLine) ||
          isAnswerSectionStart(nextLine)
        ) {
          break;
        }
        if (isAnswerLine(nextLine)) {
          const ansText = extractAnswerFromLine(nextLine) || '';
          subAnswer = extractAnswerLetters(ansText)[0] || ansText;
          j += 1;
          continue;
        }
        if (isAnalysisLine(nextLine)) {
          subAnalysis = (extractAnswerFromLine(nextLine) || '').trim();
          j += 1;
          while (
            j < lines.length &&
            isQuestionNumberPrefix(lines[j]) === null &&
            !isB1SharedHeader(lines[j]) &&
            !isAnswerSectionStart(lines[j])
          ) {
            subAnalysis += lines[j];
            j += 1;
          }
          break;
        }
        if (isOptionPrefix(nextLine)) break;
        subContent += nextLine;
        j += 1;
      }

      if (subContent) {
        subQuestions.push({ content: subContent, correctAnswer: subAnswer, analysis: subAnalysis });
        if (subAnswer) confidence = Math.min(1, confidence + 0.05);
      }
      i = j;
    } else if (isB1SharedHeader(line) || isAnswerSectionStart(line)) {
      break;
    } else {
      i += 1;
    }
    if (subQuestions.length >= 20) break;
  }

  const group: RawQuestion = {
    index: baseIndex,
    content: headerLine,
    options: sharedOptions,
    answerText: '',
    analysis: '',
    questionType: 'b1',
    subQuestions,
    b1SharedOptions: sharedOptions,
    confidence,
    warning:
      sharedOptions.length < 2
        ? '共用选项不足，可能识别不准确'
        : subQuestions.some((sq) => !sq.correctAnswer)
          ? '部分子问题答案未识别，请核对'
          : undefined,
  };

  return { group, endIndex: i };
}

function isAnswerSectionStart(line: string): boolean {
  return (
    /^(?:答案|参考答案|标准答案)\s*[：:]?\s*$/.test(line) ||
    /^【答案】/.test(line) ||
    /^[-—]+\s*答案\s*[-—]+$/i.test(line)
  );
}

function parseSingleQuestion(
  lines: string[],
  startIdx: number,
  answerMap: Map<number, string>,
  qIndex: number,
): { question: RawQuestion; endIndex: number } {
  let i = startIdx;
  const firstLine = lines[i];
  const qNum = isQuestionNumberPrefix(firstLine);

  let content = firstLine.replace(/^[\d\.．、（）()\s]+/, '').trim();
  const options: QuestionOption[] = [];
  let answerText = '';
  let analysis = '';
  let questionType: 'single' | 'multiple' = 'single';
  let confidence = 0.5;
  let warning: string | undefined;

  let j = i + 1;
  while (j < lines.length) {
    const line = lines[j];
    if (isQuestionNumberPrefix(line) !== null || isB1SharedHeader(line) || isAnswerSectionStart(line)) {
      break;
    }
    const opt = isOptionPrefix(line);
    if (opt) {
      break;
    }
    if (isAnswerLine(line)) {
      break;
    }
    if (isAnalysisLine(line)) {
      break;
    }
    content += line;
    j += 1;
  }

  const { options: collectedOpts, endIndex: optEnd } = collectOptionsFromLines(lines, j);
  options.push(...collectedOpts);
  j = optEnd;

  if (options.length >= 2) {
    confidence += 0.2;
  } else {
    warning = '选项不足，可能识别不准确';
  }

  if (j < lines.length && isAnswerLine(lines[j])) {
    const raw = extractAnswerFromLine(lines[j]) || '';
    answerText = raw;
    j += 1;
    while (
      j < lines.length &&
      isQuestionNumberPrefix(lines[j]) === null &&
      !isB1SharedHeader(lines[j]) &&
      !isAnalysisLine(lines[j]) &&
      !isAnswerSectionStart(lines[j])
    ) {
      j += 1;
    }
  }

  if (j < lines.length && isAnalysisLine(lines[j])) {
    analysis = (extractAnswerFromLine(lines[j]) || '').trim();
    j += 1;
    while (
      j < lines.length &&
      isQuestionNumberPrefix(lines[j]) === null &&
      !isB1SharedHeader(lines[j]) &&
      !isAnswerSectionStart(lines[j])
    ) {
      analysis += lines[j];
      j += 1;
    }
  }

  if (!answerText && qNum !== null) {
    const fromMap = answerMap.get(qNum);
    if (fromMap) {
      answerText = fromMap;
      confidence += 0.1;
    }
  }

  if (!answerText && analysis) {
    const inAnalysis = analysis.match(/答案[为是：:\s]*([A-Ja-j,，、\s]+)/i);
    if (inAnalysis) {
      answerText = inAnalysis[1];
    }
  }

  const answerLetters = extractAnswerLetters(answerText);
  if (answerLetters.length === 0) {
    warning = warning || '未识别到正确答案，请手动填写';
    confidence = Math.max(0.2, confidence - 0.3);
  } else if (answerLetters.length === 1) {
    questionType = 'single';
    confidence += 0.1;
  } else {
    questionType = 'multiple';
    confidence += 0.05;
  }

  if (analysis) confidence += 0.05;
  confidence = Math.min(1, Math.max(0.2, confidence));

  const question: RawQuestion = {
    index: qIndex,
    content,
    options,
    answerText,
    analysis,
    questionType,
    subQuestions: [],
    b1SharedOptions: [],
    confidence,
    warning,
  };

  return { question, endIndex: j };
}

export interface WordParseResult {
  questions: ParsedQuestionItem[];
  failures: { index: number; reason: string }[];
}

function validateQuestion(q: ParsedQuestionItem, qIndex: number): string | null {
  if (!q.content || q.content.trim() === '') {
    return '缺少题干';
  }
  if (!q.options || q.options.length < 2) {
    return '选项不足 2 个';
  }
  const optionLabels = q.options.map((o) => o.label.toUpperCase());

  if (q.questionType === 'b1') {
    if (!q.subQuestions || q.subQuestions.length === 0) {
      return 'B1型题需要提供子问题列表';
    }
    for (let i = 0; i < q.subQuestions.length; i += 1) {
      const sq = q.subQuestions[i];
      if (!sq.content || sq.content.trim() === '') {
        return `B1型题第 ${i + 1} 个子问题缺少题干`;
      }
      if (!sq.correctAnswer || sq.correctAnswer.trim() === '') {
        return `B1型题第 ${i + 1} 个子问题缺少正确答案`;
      }
      const ans = String(sq.correctAnswer).trim().toUpperCase();
      if (!optionLabels.includes(ans)) {
        return `B1型题第 ${i + 1} 个子问题的正确答案「${sq.correctAnswer}」不在选项中`;
      }
    }
    return null;
  }

  if (!q.correctAnswers || q.correctAnswers.length === 0) {
    return '缺少正确答案';
  }

  const outOfRange = q.correctAnswers.filter(
    (idx) => typeof idx !== 'number' || idx < 0 || idx >= q.options.length,
  );
  if (outOfRange.length > 0) {
    return `正确答案索引超出选项范围：[${outOfRange.join(', ')}]，共 ${q.options.length} 个选项`;
  }

  if (q.questionType === 'single' && q.correctAnswers.length !== 1) {
    return `单选题只能有 1 个正确答案，当前有 ${q.correctAnswers.length} 个`;
  }

  return null;
}

export function smartParseQuestions(rawText: string): WordParseResult {
  const lines = normalizeLines(rawText);
  if (lines.length === 0) {
    return { questions: [], failures: [{ index: 0, reason: '文档为空' }] };
  }

  const answerMap = extractAnswerAtEnd(lines);
  const resultQuestions: ParsedQuestionItem[] = [];
  const failures: { index: number; reason: string }[] = [];

  let i = 0;
  let qIndex = 0;
  const answerSectionIdx = findAnswerSection(lines);

  while (i < lines.length) {
    if (answerSectionIdx >= 0 && i >= answerSectionIdx) break;

    const line = lines[i];

    if (isB1SharedHeader(line)) {
      const { group, endIndex } = parseB1Group(lines, i, qIndex);
      const subQs: SubQuestion[] = group.subQuestions.map((sq) => ({
        content: sq.content,
        correctAnswer: sq.correctAnswer || 'A',
        analysis: sq.analysis,
      }));

      const questionItem: ParsedQuestionItem = {
        content: group.content,
        questionType: 'b1',
        options: group.b1SharedOptions,
        correctAnswers: [],
        analysis: group.analysis,
        subQuestions: subQs,
        confidence: group.confidence,
        warning: group.warning,
      };

      const validateErr = validateQuestion(questionItem, qIndex);
      if (validateErr) {
        failures.push({ index: qIndex, reason: validateErr });
      } else {
        resultQuestions.push(questionItem);
      }
      qIndex += 1;
      i = endIndex;
      continue;
    }

    const qNum = isQuestionNumberPrefix(line);
    if (qNum !== null) {
      const { question, endIndex } = parseSingleQuestion(lines, i, answerMap, qIndex);

      let correctAnswers: number[] = [];
      if (question.questionType !== 'b1') {
        const letters = extractAnswerLetters(question.answerText);
        correctAnswers = letters
          .map((l) => letterToIndex(l, question.options))
          .filter((idx) => idx >= 0);
      }

      const questionItem: ParsedQuestionItem = {
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers,
        analysis: question.analysis,
        subQuestions: [],
        confidence: question.confidence,
        warning: question.warning,
      };

      const validateErr = validateQuestion(questionItem, qIndex);
      if (validateErr) {
        failures.push({ index: qIndex, reason: validateErr });
      } else {
        resultQuestions.push(questionItem);
      }
      qIndex += 1;
      i = endIndex;
      continue;
    }

    i += 1;
  }

  if (resultQuestions.length === 0) {
    failures.push({ index: 0, reason: '未能识别出任何题目，请检查文档格式' });
  }

  return { questions: resultQuestions, failures };
}

export interface ImportPreviewResult {
  totalCount: number;
  singleCount: number;
  multipleCount: number;
  b1Count: number;
  lowConfidenceCount: number;
  questions: ParsedQuestionItem[];
  failures: { index: number; reason: string }[];
}

export function computeImportPreview(questions: ParsedQuestionItem[]): Omit<ImportPreviewResult, 'failures' | 'questions'> {
  let singleCount = 0;
  let multipleCount = 0;
  let b1Count = 0;
  let lowConfidenceCount = 0;

  for (const q of questions) {
    if (q.questionType === 'single') singleCount += 1;
    else if (q.questionType === 'multiple') multipleCount += 1;
    else if (q.questionType === 'b1') b1Count += 1;
    if ((q.confidence ?? 1) < 0.7) lowConfidenceCount += 1;
  }

  return {
    totalCount: questions.length,
    singleCount,
    multipleCount,
    b1Count,
    lowConfidenceCount,
  };
}
