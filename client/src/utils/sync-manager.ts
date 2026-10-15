/**
 * 同步管理器 - 将离线答题记录同步到后端
 * - 读取待同步 records + answers
 * - 逐条调用 API 创建练习记录
 * - 成功后标记 synced = true
 * - 失败保留，下次重试
 * - 监听 online 事件，网络恢复自动同步
 */

import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getPendingSyncRecords,
  markRecordSynced,
  type OfflineRecord,
} from './offline-db';
import { submitRecord } from '@client/src/api/practiceRecord';
import type { CreatePracticeRecordRequest } from '@shared/api.interface';

type SyncListener = (pendingCount: number) => void;

interface SyncResult {
  success: number;
  failed: number;
}

interface SyncStatus {
  pending: number;
  lastSyncTime?: string;
}

let lastSyncTime: string | undefined;

class SyncManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private listeners = new Set<SyncListener>();

  private onlineHandler = (): void => {
    logger.info('网络恢复，触发离线同步');
    this.syncOfflineData().catch((err: unknown) => {
      logger.error('网络恢复后同步失败', err);
    });
  };

  /** 同步所有离线数据 */
  async syncOfflineData(): Promise<SyncResult> {
    if (this.isSyncing) {
      logger.info('同步进行中，跳过重复调用');
      return { success: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      logger.info('当前离线，跳过同步');
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let success = 0;
    let failed = 0;

    try {
      const { records } = await getPendingSyncRecords();
      logger.info(`待同步记录：${records.length} 条`);

      // 逐条同步
      for (const record of records) {
        try {
          await this.syncOneRecord(record);
          await markRecordSynced(record.id);
          success += 1;
        } catch (err) {
          failed += 1;
          logger.error(`同步记录 ${record.id} 失败`, err);
          // 失败不中断，继续下一条
        }
      }

      lastSyncTime = new Date().toISOString();
      logger.info(`同步完成：成功 ${success}，失败 ${failed}`);
      return { success, failed };
    } finally {
      this.isSyncing = false;
      this.notifyListeners().catch((err: unknown) => {
        logger.error('通知监听器失败', err);
      });
    }
  }

  /** 同步单条记录 */
  private async syncOneRecord(record: OfflineRecord): Promise<void> {
    const answers = record.answers ?? [];

    const dto: CreatePracticeRecordRequest = {
      bankId: record.bankId,
      totalCount: record.totalCount,
      correctCount: record.correctCount,
      accuracyRate: record.accuracyRate,
      durationSeconds: record.durationSeconds,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      clientRecordId: record.id,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        userAnswers: a.userAnswers,
        isCorrect: a.isCorrect,
      })),
    };

    await submitRecord(dto);
  }

  /** 启动自动同步轮询 */
  startAutoSync(intervalMs = 30_000): void {
    this.stopAutoSync();
    this.timer = setInterval(() => {
      this.syncOfflineData().catch((err: unknown) => {
        logger.error('自动同步失败', err);
      });
    }, intervalMs);

    // 监听网络恢复事件
    window.addEventListener('online', this.onlineHandler);
    logger.info(`自动同步已启动，间隔 ${intervalMs}ms`);
  }

  /** 停止自动同步 */
  stopAutoSync(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    window.removeEventListener('online', this.onlineHandler);
    logger.info('自动同步已停止');
  }

  /** 是否正在同步 */
  get syncing(): boolean {
    return this.isSyncing;
  }

  /** 获取同步状态 */
  async getStatus(): Promise<SyncStatus> {
    try {
      const { records } = await getPendingSyncRecords();
      return {
        pending: records.length,
        lastSyncTime,
      };
    } catch (err) {
      logger.warn('获取同步状态失败', err);
      return { pending: 0, lastSyncTime };
    }
  }

  /** 订阅待同步数量变化 */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notifyListeners(): Promise<void> {
    try {
      const { records } = await getPendingSyncRecords();
      this.listeners.forEach((l) => l(records.length));
    } catch (err) {
      logger.error('获取待同步数量失败', err);
    }
  }
}

// ========== 单例 ==========
export const syncManager = new SyncManager();

// ========== 向后兼容导出 ==========

/** 同步所有离线记录（函数式） */
export async function syncOfflineRecords(): Promise<SyncResult> {
  return syncManager.syncOfflineData();
}

/** 获取同步状态 */
export async function getSyncStatus(): Promise<SyncStatus> {
  return syncManager.getStatus();
}

/** 启动自动同步 */
export function startAutoSync(intervalMs?: number): void {
  syncManager.startAutoSync(intervalMs);
}

/** 停止自动同步 */
export function stopAutoSync(): void {
  syncManager.stopAutoSync();
}
