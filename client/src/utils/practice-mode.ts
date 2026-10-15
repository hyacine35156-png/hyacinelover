import { safeGetItem } from './env';
import type { PracticeMode } from '@client/src/components/practice/PracticeModeDialog';

const LAST_MODE_KEY = 'practice_last_mode';
const SETTINGS_FALLBACK_KEY = 'practice_settings_fallback';

interface PracticeSettingsFallback {
  defaultPracticeMode: PracticeMode;
  quickFlashDelay: number;
}

/**
 * 获取当前应选中的默认刷题模式：
 * 1. 优先使用上次选择的模式（practice_last_mode）
 * 2. 其次使用设置中配置的默认模式（从本地缓存 practice_settings_fallback 读取）
 * 3. 兜底为 basic
 */
export function getDefaultPracticeMode(): PracticeMode {
  const last = safeGetItem(LAST_MODE_KEY);
  if (last && ['basic', 'recite', 'quick'].includes(last)) {
    return last as PracticeMode;
  }

  try {
    const raw = safeGetItem(SETTINGS_FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PracticeSettingsFallback>;
      if (
        parsed.defaultPracticeMode &&
        ['basic', 'recite', 'quick'].includes(parsed.defaultPracticeMode)
      ) {
        return parsed.defaultPracticeMode;
      }
    }
  } catch {
    // ignore
  }

  return 'basic';
}

export function getQuickFlashDelay(): number {
  try {
    const raw = safeGetItem(SETTINGS_FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PracticeSettingsFallback>;
      if (typeof parsed.quickFlashDelay === 'number') {
        return parsed.quickFlashDelay;
      }
    }
  } catch {
    // ignore
  }
  return 800;
}

export { LAST_MODE_KEY as PRACTICE_LAST_MODE_KEY };
