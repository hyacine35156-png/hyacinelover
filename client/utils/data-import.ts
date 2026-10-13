import { logger } from '@lark-apaas/client-toolkit/logger';
import { questionBankApi } from '@client/src/api';
import { questionTagApi } from '@client/src/api';
import { practiceRecordApi } from '@client/src/api';
import { safeSetItem } from '@client/src/utils/env';
import type { ExportData } from './data-export';
import type {
  QuestionBankItem,
  QuestionItem,
  CreateQuestionBankRequest,
  CreateQuestionRequest,
  QuestionTagItem,
  PracticeRecordDetailResponse,
} from '@shared/api.interface';

export type ImportStrategy = 'overwrite' | 'skip' | 'merge';

export interface ImportResultItem {
  key: keyof ExportData['data'];
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export interface ImportResult {
  items: ImportResultItem[];
  totalSuccess: number;
  totalFailed: number;
  totalSkipped: number;
}

export interface ImportOptions {
  strategy: ImportStrategy;
  onProgress?: (
    phase: string,
    current: number,
    total: number,
    detail?: string,
  ) => void;
}

export async function readImportFile(file: File): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event): void => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content) as unknown;
        if (
          typeof data === 'object' &&
          data !== null &&
          typeof (data as Record<string, unknown>).version === 'string' &&
          typeof (data as Record<string, unknown>).data === 'object'
        ) {
          resolve(data as ExportData);
        } else {
          reject(new Error('无效的文件格式：缺少 version 或 data 字段'));
        }
      } catch (error) {
        reject(new Error('文件解析失败：JSON 格式不正确'));
      }
    };
    reader.onerror = (): void => {
      reject(new Error('文件读取失败'));
    };
    reader.readAsText(file);
  });
}

function makeResultItem(
  key: keyof ExportData['data'],
  total = 0,
): ImportResultItem {
  return { key, total, success: 0, failed: 0, skipped: 0, errors: [] };
}

async function importQuestionBanks(
  data: ExportData['data'],
  strategy: ImportStrategy,
): Promise<{ result: ImportResultItem; bankIdMap: Map<string, string> }> {
  const result = makeResultItem('questionBanks', data.questionBanks?.length ?? 0);
  const bankIdMap = new Map<string, string>();
  const banks = data.questionBanks ?? [];

  if (banks.length === 0) return { result, bankIdMap };

  // 获取现有题库用于判断冲突
  let existingBanks: QuestionBankItem[] = [];
  try {
    const res = await questionBankApi.getBanks({ visibility: 'private' });
    existingBanks = res.items.filter(
      (b: QuestionBankItem) => b.bankType === 'normal',
    );
  } catch (error) {
     logger.error('获取现有题集失败', error);
  }

  for (const bank of banks) {
    try {
      const existing = existingBanks.find(
        (b: QuestionBankItem) => b.name === bank.name,
      );

      if (existing) {
        if (strategy === 'skip') {
          result.skipped += 1;
          bankIdMap.set(bank.id, existing.id);
          continue;
        }
        if (strategy === 'overwrite') {
          // 删除旧题库，然后新建
          try {
            await questionBankApi.deleteBank(existing.id);
          } catch (error) {
             logger.warn(`删除旧题集失败 ${existing.id}`, error);
          }
        }
        // merge 或 overwrite 后新建
      }

      const dto: CreateQuestionBankRequest = {
        name: bank.name + (strategy === 'merge' && existing ? ' (导入)' : ''),
        description: bank.description,
        subjectId: bank.subjectId ?? null,
        isPublic: bank.isPublic,
      };
      const created = await questionBankApi.createBank(dto);
      bankIdMap.set(bank.id, created.id);
      result.success += 1;
    } catch (error) {
      result.failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
       result.errors.push(`题集「${bank.name}」: ${msg}`);
    }
  }

  return { result, bankIdMap };
}

async function importQuestions(
  data: ExportData['data'],
  bankIdMap: Map<string, string>,
  strategy: ImportStrategy,
): Promise<ImportResultItem> {
  const result = makeResultItem('questions', data.questions?.length ?? 0);
  const questions = data.questions ?? [];

  if (questions.length === 0) return result;

  // 按 bank 分组题目（注意：导出时题目不带 bankId，需重建映射）
  // 实际上 QuestionItem 没有 bankId 字段，我们按顺序分配到导入的题库
  // 更简单的策略：创建一个"导入题库"集中存放
  // 但更好的方式：导出时按题库分组
  // 这里做简化：把所有导入题目放到第一个导入的题库中
  const targetBankId = bankIdMap.values().next().value as string | undefined;

  if (!targetBankId) {
    result.failed = questions.length;
     result.errors.push('没有可用的目标题集');
    return result;
  }

  // 获取现有题目用于去重（按内容判断）
  let existingContents = new Set<string>();
  try {
    const existing = await questionBankApi.getQuestions(targetBankId);
    existingContents = new Set(
      existing.items.map((q: QuestionItem) => q.content.trim()),
    );
  } catch (error) {
    logger.error('获取现有题目失败', error);
  }

  for (const q of questions) {
    try {
      if (strategy !== 'overwrite' && existingContents.has(q.content.trim())) {
        result.skipped += 1;
        continue;
      }

      const dto: CreateQuestionRequest = {
        content: q.content,
        questionType: q.questionType,
        options: q.options,
        correctAnswers: q.correctAnswers,
        analysis: q.analysis,
        subQuestions: q.subQuestions,
      };
      await questionBankApi.addQuestion(targetBankId, dto);
      result.success += 1;
    } catch (error) {
      result.failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`题目「${q.content.slice(0, 30)}...」: ${msg}`);
    }
  }

  return result;
}

async function importPracticeRecords(
  data: ExportData['data'],
  strategy: ImportStrategy,
): Promise<ImportResultItem> {
  const result = makeResultItem(
    'practiceRecords',
    data.practiceRecords?.length ?? 0,
  );
  const records = data.practiceRecords ?? [];

  if (records.length === 0) return result;

  // 简单策略：全部新建（记录通常不做去重）
  for (const record of records) {
    try {
      // 从答案计算统计信息
      const answers = record.answers.map((a) => ({
        questionId: a.questionId,
        userAnswers: a.userAnswers,
        isCorrect: a.isCorrect,
      }));
      const totalCount = answers.length;
      const correctCount = answers.filter((a) => a.isCorrect).length;
      const accuracyRate = totalCount > 0 ? correctCount / totalCount : 0;

      await practiceRecordApi.submitRecord({
        bankId: '0', // 占位
        totalCount,
        correctCount,
        accuracyRate,
        durationSeconds: 0,
        startedAt: record.finishedAt,
        finishedAt: record.finishedAt,
        answers,
      });
      result.success += 1;
    } catch (error) {
      result.failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`记录「${record.id.slice(0, 8)}...」: ${msg}`);
      void strategy; // 暂未使用
    }
  }

  return result;
}

async function importFavorites(
  data: ExportData['data'],
  _strategy: ImportStrategy,
): Promise<ImportResultItem> {
  const result = makeResultItem('favorites', data.favorites?.length ?? 0);
  const favorites = data.favorites ?? [];

  if (favorites.length === 0) return result;

  // 收藏需要题目ID对应，这里简化处理：标记为失败提示
  // 因为导入的题目ID会变化，无法直接对应
  result.skipped = favorites.length;
  result.errors.push(
    '收藏记录需要对应现有题目ID，建议先导入题目再手动收藏',
  );

  return result;
}

async function importWrongBook(
  data: ExportData['data'],
  _strategy: ImportStrategy,
): Promise<ImportResultItem> {
  const result = makeResultItem('wrongBook', data.wrongBook?.length ?? 0);
  const wrongBook = data.wrongBook ?? [];

  if (wrongBook.length === 0) return result;

  // 错题本同样需要题目ID对应
  result.skipped = wrongBook.length;
  result.errors.push('错题本记录需要对应现有题目ID，已跳过');

  return result;
}

async function importTags(
  data: ExportData['data'],
  strategy: ImportStrategy,
): Promise<ImportResultItem> {
  const result = makeResultItem('tags', data.tags?.length ?? 0);
  const tags = data.tags ?? [];

  if (tags.length === 0) return result;

  let existingTags: QuestionTagItem[] = [];
  try {
    const res = await questionTagApi.listTags();
    existingTags = res.items;
  } catch (error) {
    logger.error('获取现有标签失败', error);
  }

  const existingNames = new Set(existingTags.map((t: QuestionTagItem) => t.name));

  for (const tag of tags) {
    try {
      if (existingNames.has(tag.name)) {
        if (strategy === 'skip' || strategy === 'merge') {
          result.skipped += 1;
          continue;
        }
        // overwrite 时重命名
      }
      await questionTagApi.createTag({
        name: tag.name + (strategy === 'overwrite' && existingNames.has(tag.name) ? ' (导入)' : ''),
        color: tag.color,
        labelType: tag.labelType,
      });
      result.success += 1;
    } catch (error) {
      result.failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`标签「${tag.name}」: ${msg}`);
    }
  }

  return result;
}

function importSettings(data: ExportData['data']): ImportResultItem {
  const result = makeResultItem('settings');
  const settings = data.settings;

  if (!settings) {
    result.total = 0;
    return result;
  }
  result.total = 4;

  try {
    if (settings.theme) {
      safeSetItem('hyacine_theme', settings.theme);
      result.success += 1;
    } else {
      result.skipped += 1;
    }
    if (settings.fontSize) {
      safeSetItem('hyacine_font_size', settings.fontSize);
      result.success += 1;
    } else {
      result.skipped += 1;
    }
    if (settings.voiceRate !== undefined && settings.voiceRate !== null) {
      safeSetItem('hyacine_voice_speed', String(settings.voiceRate));
      result.success += 1;
    } else {
      result.skipped += 1;
    }
    if (settings.voiceScope) {
      safeSetItem('hyacine_voice_scope', settings.voiceScope);
      result.success += 1;
    } else {
      result.skipped += 1;
    }
  } catch (error) {
    result.failed += 1;
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(msg);
  }

  return result;
}

export async function importData(
  data: ExportData,
  options: ImportOptions,
): Promise<ImportResult> {
  const { strategy, onProgress } = options;
  const phases: { key: keyof ExportData['data']; label: string }[] = [];

  if (data.data.questionBanks?.length) phases.push({ key: 'questionBanks', label: '导入题集' });
  if (data.data.questions?.length) phases.push({ key: 'questions', label: '导入题目' });
  if (data.data.practiceRecords?.length) phases.push({ key: 'practiceRecords', label: '导入记录' });
  if (data.data.favorites?.length) phases.push({ key: 'favorites', label: '导入收藏' });
  if (data.data.wrongBook?.length) phases.push({ key: 'wrongBook', label: '导入错题本' });
  if (data.data.tags?.length) phases.push({ key: 'tags', label: '导入标签' });
  if (data.data.settings) phases.push({ key: 'settings', label: '导入设置' });

  const totalPhases = phases.length;
  const results: ImportResultItem[] = [];
  let bankIdMap = new Map<string, string>();

  for (let i = 0; i < phases.length; i += 1) {
    const phase = phases[i];
    onProgress?.(phase.label, i, totalPhases);

    try {
      switch (phase.key) {
        case 'questionBanks': {
          const { result, bankIdMap: map } = await importQuestionBanks(
            data.data,
            strategy,
          );
          bankIdMap = map;
          results.push(result);
          break;
        }
        case 'questions': {
          // 如果题库也一起导入则使用新建的bankIdMap，否则尝试找现有题库
          if (bankIdMap.size === 0) {
            // 创建一个导入专用题库
            try {
              const created = await questionBankApi.createBank({
                name: `导入的题目-${new Date().toLocaleDateString()}`,
                description: '从备份文件导入',
              });
              bankIdMap.set('__import__', created.id);
            } catch (error) {
               logger.error('创建导入题集失败', error);
            }
          }
          const r = await importQuestions(data.data, bankIdMap, strategy);
          results.push(r);
          break;
        }
        case 'practiceRecords': {
          const r = await importPracticeRecords(data.data, strategy);
          results.push(r);
          break;
        }
        case 'favorites': {
          const r = await importFavorites(data.data, strategy);
          results.push(r);
          break;
        }
        case 'wrongBook': {
          const r = await importWrongBook(data.data, strategy);
          results.push(r);
          break;
        }
        case 'tags': {
          const r = await importTags(data.data, strategy);
          results.push(r);
          break;
        }
        case 'settings': {
          const r = importSettings(data.data);
          results.push(r);
          break;
        }
        default:
          break;
      }
    } catch (error) {
      logger.error(`导入阶段 ${phase.label} 失败`, error);
      results.push({
        key: phase.key,
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  onProgress?.('完成', totalPhases, totalPhases);

  const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

  return { items: results, totalSuccess, totalFailed, totalSkipped };
}

export function getImportPreview(data: ExportData): { key: string; label: string; count: number }[] {
  return [
     { key: 'questionBanks', label: '题集', count: data.data.questionBanks?.length ?? 0 },
    { key: 'questions', label: '题目', count: data.data.questions?.length ?? 0 },
    { key: 'practiceRecords', label: '练习记录', count: data.data.practiceRecords?.length ?? 0 },
    { key: 'favorites', label: '收藏', count: data.data.favorites?.length ?? 0 },
    { key: 'wrongBook', label: '错题本', count: data.data.wrongBook?.length ?? 0 },
    { key: 'tags', label: '标签', count: data.data.tags?.length ?? 0 },
    { key: 'settings', label: '设置', count: data.data.settings ? 1 : 0 },
  ].filter((item) => item.count > 0);
}
