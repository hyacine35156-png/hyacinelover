/**
 * 离线数据库 - 基于原生 IndexedDB 封装
 * 存储题库、题目、离线答题记录、下载元信息
 */

import type {
  QuestionBankItem,
  QuestionItem,
  PracticeAnswerItem,
} from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

const DB_NAME = 'hyacine-offline';
const DB_VERSION = 1;

// Store 名称
export const STORE_BANKS = 'banks';
export const STORE_QUESTIONS = 'questions';
export const STORE_OFFLINE_ANSWERS = 'offlineAnswers';
export const STORE_OFFLINE_RECORDS = 'offlineRecords';
export const STORE_DOWNLOAD_META = 'downloadMeta';

// 离线答题记录
export interface OfflineAnswer {
  id: string;
  questionId: string;
  bankId: string;
  recordId: string;
  userAnswers: string[];
  isCorrect: boolean;
  durationSeconds: number;
  answeredAt: string;
  synced: boolean;
  questionIndex: number;
}

// 离线练习会话
export interface OfflineRecord {
  id: string;
  bankId: string;
  bankName: string;
  totalCount: number;
  correctCount: number;
  startedAt: string;
  finishedAt: string;
  status: 'completed' | 'in_progress';
  synced: boolean;
  source: 'offline';
  durationSeconds: number;
  accuracyRate: number;
  answers: PracticeAnswerItem[];
}

// 下载元信息
export interface DownloadMeta {
  bankId: string;
  bankName: string;
  downloadedAt: string;
  questionCount: number;
  sizeBytes: number;
  description?: string;
  questionTypeCount?: Record<string, number>;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let dbAvailable = true;

function isValidKey(key: unknown): boolean {
  if (key === undefined || key === null) return false;
  const t = typeof key;
  if (t === 'string' || t === 'number') return true;
  if (key instanceof Date && !isNaN(key.getTime())) return true;
  if (Array.isArray(key)) {
    if (key.length === 0) return false;
    return key.every((k) => isValidKey(k));
  }
  return false;
}

function safeKeyRangeOnly(key: unknown): IDBKeyRange | null {
  try {
    if (!isValidKey(key)) return null;
    return IDBKeyRange.only(key as IDBValidKey);
  } catch {
    return null;
  }
}

/**
 * 打开/获取数据库连接（单例）
 */
function getDb(): Promise<IDBDatabase> {
  if (!dbAvailable) return Promise.reject(new Error('IndexedDB 不可用'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      dbAvailable = false;
      reject(new Error('IndexedDB 不可用'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      dbAvailable = false;
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 题库元数据
      if (!db.objectStoreNames.contains(STORE_BANKS)) {
        db.createObjectStore(STORE_BANKS, { keyPath: 'id' });
      }

      // 题目数据，按 bankId 建索引
      if (!db.objectStoreNames.contains(STORE_QUESTIONS)) {
        const store = db.createObjectStore(STORE_QUESTIONS, { keyPath: 'id' });
        store.createIndex('bankId', 'bankId', { unique: false });
      }

      // 离线答题记录
      if (!db.objectStoreNames.contains(STORE_OFFLINE_ANSWERS)) {
        const store = db.createObjectStore(STORE_OFFLINE_ANSWERS, { keyPath: 'id' });
        store.createIndex('bankId', 'bankId', { unique: false });
        store.createIndex('recordId', 'recordId', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }

      // 离线练习会话
      if (!db.objectStoreNames.contains(STORE_OFFLINE_RECORDS)) {
        const store = db.createObjectStore(STORE_OFFLINE_RECORDS, { keyPath: 'id' });
        store.createIndex('bankId', 'bankId', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }

      // 下载元信息
      if (!db.objectStoreNames.contains(STORE_DOWNLOAD_META)) {
        db.createObjectStore(STORE_DOWNLOAD_META, { keyPath: 'bankId' });
      }
    };
  });

  return dbPromise.catch((err) => {
    dbAvailable = false;
    dbPromise = null;
    throw err;
  });
}

/**
 * 在指定 store 上执行事务，返回 Promise
 */
function transaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  return getDb().then((db) => {
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);

      tx.oncomplete = () => {
        if (request) resolve(request.result);
        else resolve(undefined as unknown as T);
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

/** 打开数据库（向后兼容别名） */
export async function openDB(): Promise<void> {
  await getDb();
}

// ========== 题库相关 ==========

/** 保存题库元数据 */
export async function saveBank(bank: QuestionBankItem): Promise<void> {
  try {
    await transaction(STORE_BANKS, 'readwrite', (store) => store.put(bank));
  } catch (err) {
    logger.warn('[offline-db] saveBank 失败', String(err));
  }
}

/** 批量保存题目（按 bankId 覆盖式写入） */
export async function saveQuestions(
  bankId: string,
  questions: QuestionItem[],
): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUESTIONS, 'readwrite');
    const store = tx.objectStore(STORE_QUESTIONS);

    // 先删除该 bankId 下所有旧题目
    const index = store.index('bankId');
    const range = safeKeyRangeOnly(bankId);
    if (!range) {
      tx.oncomplete = () => resolve();
      return;
    }
    const deleteRequest = index.openCursor(range);
    deleteRequest.onsuccess = () => {
      const cursor = deleteRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // 再写入新题目
    questions.forEach((q) => {
      store.put({ ...q, bankId });
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** 获取题库元数据 */
export async function getBank(bankId: string): Promise<QuestionBankItem | undefined> {
  try {
    return transaction<QuestionBankItem | undefined>(STORE_BANKS, 'readonly', (store) =>
      store.get(bankId),
    );
  } catch (err) {
    logger.warn('[offline-db] getBank 失败', String(err));
    return undefined;
  }
}

/** 获取某题库的所有题目 */
export async function getQuestions(bankId: string): Promise<QuestionItem[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUESTIONS, 'readonly');
      const store = tx.objectStore(STORE_QUESTIONS);
      const index = store.index('bankId');
      const range = safeKeyRangeOnly(bankId);
      if (!range) {
        resolve([]);
        return;
      }
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result as QuestionItem[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    logger.warn('[offline-db] getQuestions 失败', String(err));
    return [];
  }
}

/** 获取某题库的所有题目（向后兼容别名） */
export async function getQuestionsByBank(bankId: string): Promise<QuestionItem[]> {
  return getQuestions(bankId);
}

/** 获取已下载题库列表（返回 QuestionBankItem 数组，向后兼容） */
export async function getDownloadedBanks(): Promise<QuestionBankItem[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BANKS, 'readonly');
      const store = tx.objectStore(STORE_BANKS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as QuestionBankItem[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    logger.warn('[offline-db] getDownloadedBanks 失败', String(err));
    return [];
  }
}

/** 获取下载元信息列表 */
export async function getDownloadMetaList(): Promise<DownloadMeta[]> {
  try {
    return transaction<DownloadMeta[]>(STORE_DOWNLOAD_META, 'readonly', (store) =>
      store.getAll(),
    );
  } catch (err) {
    logger.warn('[offline-db] getDownloadMetaList 失败', String(err));
    return [];
  }
}

/** 保存下载元信息 */
export async function saveDownloadMeta(meta: DownloadMeta): Promise<void> {
  try {
    await transaction(STORE_DOWNLOAD_META, 'readwrite', (store) => store.put(meta));
  } catch (err) {
    logger.warn('[offline-db] saveDownloadMeta 失败', String(err));
  }
}

/** 删除已下载的题库（含题目、元数据、下载信息） */
export async function deleteDownloadedBank(bankId: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORE_BANKS, STORE_QUESTIONS, STORE_DOWNLOAD_META],
        'readwrite',
      );

      tx.objectStore(STORE_BANKS).delete(bankId);

      const questionStore = tx.objectStore(STORE_QUESTIONS);
      const qIndex = questionStore.index('bankId');
      const qRange = safeKeyRangeOnly(bankId);
      if (qRange) {
        const qCursor = qIndex.openCursor(qRange);
        qCursor.onsuccess = () => {
          const cursor = qCursor.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }

      tx.objectStore(STORE_DOWNLOAD_META).delete(bankId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    logger.warn('[offline-db] deleteDownloadedBank 失败', String(err));
  }
}

/** 删除题库（向后兼容别名） */
export async function deleteBank(bankId: string): Promise<void> {
  return deleteDownloadedBank(bankId);
}

/** 计算总缓存大小（粗略估算，基于 JSON 序列化字节数） */
export async function getTotalCacheSize(): Promise<number> {
  try {
    const db = await getDb();
    let total = 0;

    const stores = [STORE_BANKS, STORE_QUESTIONS, STORE_DOWNLOAD_META, STORE_OFFLINE_RECORDS, STORE_OFFLINE_ANSWERS];

    for (const storeName of stores) {
      const items = await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error);
      });

      for (const item of items) {
        total += new Blob([JSON.stringify(item)]).size;
      }
    }

    return total;
  } catch (err) {
    logger.warn('[offline-db] getTotalCacheSize 失败', String(err));
    return 0;
  }
}

/** 计算总缓存大小（向后兼容别名） */
export async function getStorageSize(): Promise<number> {
  return getTotalCacheSize();
}

/** 格式化字节数为人类可读字符串 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** 下载整个题库（带进度回调） */
export async function downloadBank(
  bank: QuestionBankItem,
  onProgress?: (current: number, total: number) => void,
  fetchQuestions?: (bankId: string) => Promise<QuestionItem[]>,
  questionFetcher?: (bankId: string) => Promise<QuestionItem[]>,
): Promise<void> {
  const fetcher = questionFetcher ?? fetchQuestions;
  if (!fetcher) {
    throw new Error('需要提供题目获取函数');
  }

  const questions = await fetcher(bank.id);
  onProgress?.(questions.length, questions.length);

  await saveBank(bank);
  await saveQuestions(bank.id, questions);

  // 计算大小并保存下载元信息
  const sizeBytes =
    new Blob([JSON.stringify(bank)]).size +
    questions.reduce((sum, q) => sum + new Blob([JSON.stringify(q)]).size, 0);

  await saveDownloadMeta({
    bankId: bank.id,
    bankName: bank.name,
    downloadedAt: new Date().toISOString(),
    questionCount: questions.length,
    sizeBytes,
    description: bank.description,
  });
}

/** 清除所有离线缓存 */
export async function clearAllOfflineData(): Promise<void> {
  try {
    const db = await getDb();
    const stores = [
      STORE_BANKS,
      STORE_QUESTIONS,
      STORE_DOWNLOAD_META,
      STORE_OFFLINE_RECORDS,
      STORE_OFFLINE_ANSWERS,
    ];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    logger.warn('[offline-db] clearAllOfflineData 失败', String(err));
  }
}

// ========== 答题记录相关 ==========

/** 保存单条离线答题记录 */
export async function saveOfflineAnswer(answer: OfflineAnswer): Promise<void> {
  try {
    await transaction(STORE_OFFLINE_ANSWERS, 'readwrite', (store) => store.put(answer));
  } catch (err) {
    logger.warn('[offline-db] saveOfflineAnswer 失败', String(err));
  }
}

/** 批量保存离线答题记录 */
export async function saveOfflineAnswers(answers: OfflineAnswer[]): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OFFLINE_ANSWERS, 'readwrite');
      const store = tx.objectStore(STORE_OFFLINE_ANSWERS);
      answers.forEach((a) => store.put(a));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    logger.warn('[offline-db] saveOfflineAnswers 失败', String(err));
  }
}

/** 离线练习记录创建参数 */
export interface SaveOfflineRecordInput {
  bankId: string;
  bankName: string;
  answers: PracticeAnswerItem[];
  durationSeconds: number;
  totalCount: number;
  correctCount: number;
  accuracyRate: number;
  startedAt: string;
  finishedAt: string;
  synced: boolean;
}

/** 生成简单唯一 ID */
function generateId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 保存离线练习会话（含答案明细） */
export async function saveOfflineRecord(input: SaveOfflineRecordInput): Promise<void> {
  try {
    const recordId = generateId();

    const record: OfflineRecord = {
      id: recordId,
      bankId: input.bankId,
      bankName: input.bankName,
      totalCount: input.totalCount,
      correctCount: input.correctCount,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      status: 'completed',
      synced: input.synced,
      source: 'offline',
      durationSeconds: input.durationSeconds,
      accuracyRate: input.accuracyRate,
      answers: input.answers,
    };

    const answers: OfflineAnswer[] = input.answers.map((a, idx) => ({
      id: `${recordId}_a${idx}`,
      questionId: a.questionId,
      bankId: input.bankId,
      recordId,
      userAnswers: a.userAnswers.map((v) => String(v)),
      isCorrect: a.isCorrect,
      durationSeconds: 0,
      answeredAt: input.finishedAt,
      synced: input.synced,
      questionIndex: idx,
    }));

    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORE_OFFLINE_RECORDS, STORE_OFFLINE_ANSWERS],
        'readwrite',
      );
      tx.objectStore(STORE_OFFLINE_RECORDS).put(record);
      answers.forEach((a) => tx.objectStore(STORE_OFFLINE_ANSWERS).put(a));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    logger.warn('[offline-db] saveOfflineRecord 失败', String(err));
  }
}

/** 获取待同步的记录和答题（未同步的） */
export async function getPendingSyncRecords(): Promise<{
  records: OfflineRecord[];
  answers: OfflineAnswer[];
}> {
  try {
    const db = await getDb();

    const syncedRange = safeKeyRangeOnly(false);
    if (!syncedRange) {
      return { records: [], answers: [] };
    }

    const [records, answers] = await Promise.all([
      new Promise<OfflineRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_OFFLINE_RECORDS, 'readonly');
        const store = tx.objectStore(STORE_OFFLINE_RECORDS);
        const index = store.index('synced');
        const request = index.getAll(syncedRange);
        request.onsuccess = () => resolve(request.result as OfflineRecord[]);
        request.onerror = () => reject(request.error);
      }),
      new Promise<OfflineAnswer[]>((resolve, reject) => {
        const tx = db.transaction(STORE_OFFLINE_ANSWERS, 'readonly');
        const store = tx.objectStore(STORE_OFFLINE_ANSWERS);
        const index = store.index('synced');
        const request = index.getAll(syncedRange);
        request.onsuccess = () => resolve(request.result as OfflineAnswer[]);
        request.onerror = () => reject(request.error);
      }),
    ]);

    return { records, answers };
  } catch (err) {
    logger.warn('[offline-db] getPendingSyncRecords 失败', String(err));
    return { records: [], answers: [] };
  }
}

/** 标记记录及关联答案为已同步 */
export async function markRecordSynced(recordId: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORE_OFFLINE_RECORDS, STORE_OFFLINE_ANSWERS],
        'readwrite',
      );

      const recordStore = tx.objectStore(STORE_OFFLINE_RECORDS);
      const recordReq = recordStore.get(recordId);
      recordReq.onsuccess = () => {
        const record = recordReq.result as OfflineRecord | undefined;
        if (record) {
          recordStore.put({ ...record, synced: true });
        }
      };

      const answerStore = tx.objectStore(STORE_OFFLINE_ANSWERS);
      const ansIndex = answerStore.index('recordId');
      const ansRange = safeKeyRangeOnly(recordId);
      if (ansRange) {
        const ansCursor = ansIndex.openCursor(ansRange);
        ansCursor.onsuccess = () => {
          const cursor = ansCursor.result;
          if (cursor) {
            const answer = cursor.value as OfflineAnswer;
            cursor.update({ ...answer, synced: true });
            cursor.continue();
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    logger.error('[offline-db] markRecordSynced 失败', String(err));
    throw err;
  }
}

/** 获取离线练习记录列表 */
export async function getOfflineRecords(bankId?: string): Promise<OfflineRecord[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OFFLINE_RECORDS, 'readonly');
      const store = tx.objectStore(STORE_OFFLINE_RECORDS);

      let request: IDBRequest<OfflineRecord[]>;
      if (bankId) {
        const index = store.index('bankId');
        const range = safeKeyRangeOnly(bankId);
        if (!range) {
          resolve([]);
          return;
        }
        request = index.getAll(range) as IDBRequest<OfflineRecord[]>;
      } else {
        request = store.getAll() as IDBRequest<OfflineRecord[]>;
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    logger.warn('[offline-db] getOfflineRecords 失败', String(err));
    return [];
  }
}

/** 获取待同步记录数量 */
export async function getPendingSyncCount(): Promise<number> {
  const { records } = await getPendingSyncRecords();
  return records.length;
}
