import { logger } from '@lark-apaas/client-toolkit/logger';
import { questionBankApi } from '@client/src/api';
import { questionTagApi } from '@client/src/api';
import { practiceRecordApi } from '@client/src/api';
import { auth } from '@client/src/api';
import { safeGetItem } from '@client/src/utils/env';
import type {
  QuestionBankItem,
  QuestionItem,
  PracticeRecordDetailResponse,
  QuestionTagItem,
} from '@shared/api.interface';

export interface ExportData {
  version: string;
  exportedAt: string;
  username: string;
  data: {
    questionBanks: QuestionBankItem[];
    questions: QuestionItem[];
    practiceRecords: PracticeRecordDetailResponse[];
    favorites: string[];
    wrongBook: string[];
    tags: QuestionTagItem[];
    settings: {
      theme: string;
      fontSize: string;
      voiceRate: number;
      voiceScope: string;
    };
  };
}

export type ExportDataType =
  | 'questionBanks'
  | 'questions'
  | 'practiceRecords'
  | 'favorites'
  | 'wrongBook'
  | 'tags'
  | 'settings';

export const EXPORT_DATA_TYPES: { key: ExportDataType; label: string; description: string }[] = [
  { key: 'questionBanks', label: '题集', description: '所有自定义题集的基本信息' },
  { key: 'questions', label: '题目', description: '每个题集中的题目内容' },
    { key: 'practiceRecords', label: '练习记录', description: '所有作答记录与作答详情' },
  { key: 'favorites', label: '收藏', description: '收藏的题目列表' },
  { key: 'wrongBook', label: '错题本', description: '错题本中的题目' },
  { key: 'tags', label: '标签', description: '自定义标签' },
  { key: 'settings', label: '设置', description: '主题、字号、语音等偏好' },
];

const EXPORT_VERSION = '1.1.0';

function formatDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function downloadJson(data: ExportData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hyacine-backup-${formatDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ExportOptions {
  types: ExportDataType[];
  onProgress?: (step: string, current: number, total: number) => void;
}

async function fetchAllBanks(): Promise<QuestionBankItem[]> {
  const res = await questionBankApi.getBanks({ visibility: 'private' });
  return res.items.filter((b: QuestionBankItem) => b.bankType === 'normal');
}

async function fetchAllQuestions(banks: QuestionBankItem[]): Promise<QuestionItem[]> {
  const allQuestions: QuestionItem[] = [];
  for (const bank of banks) {
    try {
      const res = await questionBankApi.getQuestions(bank.id);
      allQuestions.push(...res.items);
    } catch (error) {
       logger.error(`获取题集 ${bank.id} 的题目失败`, error);
    }
  }
  return allQuestions;
}

async function fetchAllPracticeRecords(): Promise<PracticeRecordDetailResponse[]> {
  const records: PracticeRecordDetailResponse[] = [];
  let page = 1;
  const pageSize = 50;
  // 先获取第一页看总数
  const first = await practiceRecordApi.getRecords(page, pageSize);
  const totalPages = Math.ceil(first.total / pageSize);

  for (let p = 1; p <= totalPages; p += 1) {
    const res =
      p === 1 ? first : await practiceRecordApi.getRecords(p, pageSize);
    for (const item of res.items) {
      try {
        const detail = await practiceRecordApi.getRecordDetail(item.id);
        records.push(detail);
      } catch (error) {
        logger.error(`获取记录详情失败 ${item.id}`, error);
      }
    }
  }
  return records;
}

async function fetchFavorites(): Promise<string[]> {
  try {
    const res = await questionBankApi.getFavoriteList();
    return res.items.map((q: { id: string }) => q.id);
  } catch (error) {
    logger.error('获取收藏列表失败', error);
    return [];
  }
}

async function fetchWrongBook(): Promise<string[]> {
  try {
    const res = await questionBankApi.getWrongBookList();
    return res.items.map((q: { id: string }) => q.id);
  } catch (error) {
    logger.error('获取错题本失败', error);
    return [];
  }
}

async function fetchTags(): Promise<QuestionTagItem[]> {
  try {
    const res = await questionTagApi.listTags();
    return res.items;
  } catch (error) {
    logger.error('获取标签失败', error);
    return [];
  }
}

function readSettings(): ExportData['data']['settings'] {
  return {
    theme: safeGetItem('hyacine_theme') || 'light',
    fontSize: safeGetItem('hyacine_font_size') || 'lg',
    voiceRate: Number(safeGetItem('hyacine_voice_speed') || '1'),
    voiceScope: safeGetItem('hyacine_voice_scope') || 'none',
  };
}

export async function exportData(options: ExportOptions): Promise<void> {
  const { types, onProgress } = options;
  const totalSteps = types.length + 2; // +1 get username +1 download
  let currentStep = 0;

  const advance = (step: string): void => {
    currentStep += 1;
    onProgress?.(step, currentStep, totalSteps);
  };

  // 获取用户名
  let username = 'unknown';
  try {
    const user = await auth.getMe();
    username = user.username;
  } catch (error) {
    logger.warn('获取用户信息失败，使用默认用户名', error);
  }
  advance('user');

    // 预取题集（题目和记录可能依赖）
  let banks: QuestionBankItem[] = [];
  if (types.includes('questionBanks') || types.includes('questions')) {
    banks = await fetchAllBanks();
  }

  const exportPayload: ExportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    username,
    data: {
      questionBanks: [],
      questions: [],
      practiceRecords: [],
      favorites: [],
      wrongBook: [],
      tags: [],
      settings: {
        theme: 'light',
        fontSize: 'medium',
        voiceRate: 1,
        voiceScope: 'none',
      },
    },
  };

  if (types.includes('questionBanks')) {
    exportPayload.data.questionBanks = banks;
    advance('questionBanks');
  }

  if (types.includes('questions')) {
    exportPayload.data.questions = await fetchAllQuestions(banks);
    advance('questions');
  }

  if (types.includes('practiceRecords')) {
    exportPayload.data.practiceRecords = await fetchAllPracticeRecords();
    advance('practiceRecords');
  }

  if (types.includes('favorites')) {
    exportPayload.data.favorites = await fetchFavorites();
    advance('favorites');
  }

  if (types.includes('wrongBook')) {
    exportPayload.data.wrongBook = await fetchWrongBook();
    advance('wrongBook');
  }

  if (types.includes('tags')) {
    exportPayload.data.tags = await fetchTags();
    advance('tags');
  }

  if (types.includes('settings')) {
    exportPayload.data.settings = readSettings();
    advance('settings');
  }

  advance('download');
  downloadJson(exportPayload);
}

export function validateExportFile(data: unknown): data is ExportData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'string') return false;
  if (typeof d.exportedAt !== 'string') return false;
  if (typeof d.data !== 'object' || d.data === null) return false;
  return true;
}
