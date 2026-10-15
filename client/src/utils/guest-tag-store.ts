import { logger } from '@lark-apaas/client-toolkit/logger';
import { safeGetItem, safeSetItem } from '@client/src/utils/env';
import type { QuestionTagItem, LabelType } from '@shared/api.interface';

const GUEST_TAGS_KEY = 'hyacine_guest_tags';
const GUEST_QUESTION_TAGS_KEY = 'hyacine_guest_question_tags';

interface GuestTagStore {
  tags: QuestionTagItem[];
}

interface GuestQuestionTagStore {
  [questionId: string]: string[];
}

function readTags(): GuestTagStore {
  const raw = safeGetItem(GUEST_TAGS_KEY);
  if (!raw) return { tags: [] };
  try {
    return JSON.parse(raw) as GuestTagStore;
  } catch {
    return { tags: [] };
  }
}

function writeTags(store: GuestTagStore): void {
  safeSetItem(GUEST_TAGS_KEY, JSON.stringify(store));
}

function readQuestionTags(): GuestQuestionTagStore {
  const raw = safeGetItem(GUEST_QUESTION_TAGS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as GuestQuestionTagStore;
  } catch {
    return {};
  }
}

function writeQuestionTags(store: GuestQuestionTagStore): void {
  safeSetItem(GUEST_QUESTION_TAGS_KEY, JSON.stringify(store));
}

function genId(): string {
  return 'local-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const guestTagApi = {
  listTags(): QuestionTagItem[] {
    const store = readTags();
    return store.tags;
  },

  createTag(dto: { name: string; color?: string; labelType?: LabelType }): QuestionTagItem {
    const store = readTags();
    const name = dto.name.trim();
    if (store.tags.some((t) => t.name === name)) {
      throw new Error('同名标签已存在');
    }
    const now = new Date().toISOString();
    const tag: QuestionTagItem = {
      id: genId(),
      name,
      color: dto.color || 'blue',
      labelType: (dto.labelType as LabelType) || 'private',
      questionCount: 0,
      createdAt: now,
    };
    store.tags.unshift(tag);
    writeTags(store);
    logger.info('[GuestTag] 创建标签', { name });
    return tag;
  },

  updateTag(id: string, dto: { name?: string; color?: string; labelType?: LabelType }): { success: boolean } {
    const store = readTags();
    const idx = store.tags.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('标签不存在');
    if (dto.name !== undefined) store.tags[idx].name = dto.name.trim();
    if (dto.color !== undefined) store.tags[idx].color = dto.color;
    if (dto.labelType !== undefined) store.tags[idx].labelType = dto.labelType as LabelType;
    writeTags(store);
    return { success: true };
  },

  deleteTag(id: string): { success: boolean } {
    const store = readTags();
    store.tags = store.tags.filter((t) => t.id !== id);
    writeTags(store);

    const qt = readQuestionTags();
    Object.keys(qt).forEach((qid) => {
      qt[qid] = qt[qid].filter((tid) => tid !== id);
      if (qt[qid].length === 0) delete qt[qid];
    });
    writeQuestionTags(qt);
    return { success: true };
  },

  getQuestionTags(questionId: string): QuestionTagItem[] {
    const qt = readQuestionTags();
    const tagIds = qt[questionId] || [];
    const store = readTags();
    return store.tags.filter((t) => tagIds.includes(t.id));
  },

  setQuestionTags(questionId: string, tagIds: string[]): { success: boolean; tags: QuestionTagItem[] } {
    const qt = readQuestionTags();
    const unique = Array.from(new Set(tagIds));
    if (unique.length === 0) {
      delete qt[questionId];
    } else {
      qt[questionId] = unique;
    }
    writeQuestionTags(qt);

    const store = readTags();
    const tags = store.tags.filter((t) => unique.includes(t.id));
    logger.info('[GuestTag] 设置题目标签', { questionId, count: unique.length });
    return { success: true, tags };
  },

  addTagToQuestion(questionId: string, tagId: string): { success: boolean } {
    const qt = readQuestionTags();
    const current = qt[questionId] || [];
    if (!current.includes(tagId)) {
      qt[questionId] = [...current, tagId];
      writeQuestionTags(qt);
    }
    return { success: true };
  },

  removeTagFromQuestion(questionId: string, tagId: string): { success: boolean } {
    const qt = readQuestionTags();
    if (!qt[questionId]) return { success: true };
    qt[questionId] = qt[questionId].filter((t) => t !== tagId);
    if (qt[questionId].length === 0) delete qt[questionId];
    writeQuestionTags(qt);
    return { success: true };
  },
};
