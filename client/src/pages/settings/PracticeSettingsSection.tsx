import { useState, useEffect } from 'react';
import { BookOpen, Zap } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { SettingRow } from './SettingSection';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { userSettingsApi } from '@client/src/api';
import { safeGetItem, safeSetItem } from '@client/src/utils/env';
import type { PracticeMode } from '@client/src/components/practice/PracticeModeDialog';
import { PRACTICE_LAST_MODE_KEY } from '@client/src/utils/practice-mode';

const FALLBACK_KEY = 'practice_settings_fallback';

interface PracticeSettingsLocal {
  defaultPracticeMode: PracticeMode;
  quickFlashDelay: number;
}

const MODE_OPTIONS: { value: PracticeMode; label: string }[] = [
  { value: 'basic', label: '基础模式' },
  { value: 'recite', label: '速记模式' },
  { value: 'quick', label: '速读模式' },
];

const DEFAULT_SETTINGS: PracticeSettingsLocal = {
  defaultPracticeMode: 'basic',
  quickFlashDelay: 800,
};

const MIN_DELAY = 200;
const MAX_DELAY = 2000;
const DELAY_STEP = 100;

function getFallbackSettings(): PracticeSettingsLocal {
  try {
    const raw = safeGetItem(FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PracticeSettingsLocal>;
      return {
        defaultPracticeMode:
          (parsed.defaultPracticeMode as PracticeMode) ??
          DEFAULT_SETTINGS.defaultPracticeMode,
        quickFlashDelay:
          typeof parsed.quickFlashDelay === 'number'
            ? parsed.quickFlashDelay
            : DEFAULT_SETTINGS.quickFlashDelay,
      };
    }
  } catch (error) {
    logger.warn('[PracticeSettings] 读取本地缓存失败', error);
  }
  return { ...DEFAULT_SETTINGS };
}

function setFallbackSettings(settings: PracticeSettingsLocal): void {
  try {
    safeSetItem(FALLBACK_KEY, JSON.stringify(settings));
  } catch (error) {
    logger.warn('[PracticeSettings] 写入本地缓存失败', error);
  }
}

const PracticeSettingsSection = () => {
  const [defaultMode, setDefaultMode] = useState<PracticeMode>(
    () => getFallbackSettings().defaultPracticeMode,
  );
  const [quickFlashDelay, setQuickFlashDelay] = useState<number>(
    () => getFallbackSettings().quickFlashDelay,
  );
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 初次加载从后端同步
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const res = await userSettingsApi.getSettings();
        if (cancelled) return;
        const settings = res as unknown as Record<string, unknown>;
        let mode: PracticeMode | undefined;
        let delay: number | undefined;

        if (
          typeof settings.defaultPracticeMode === 'string' &&
          ['basic', 'recite', 'quick'].includes(settings.defaultPracticeMode)
        ) {
          mode = settings.defaultPracticeMode as PracticeMode;
        }
        if (
          typeof settings.quickFlashDelay === 'number' &&
          Number.isFinite(settings.quickFlashDelay)
        ) {
          delay = settings.quickFlashDelay;
        }

        if (mode) setDefaultMode(mode);
        if (delay !== undefined) setQuickFlashDelay(delay);
      } catch (error) {
        logger.warn('[PracticeSettings] 从服务端加载失败，使用本地缓存', error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = async (
    patch: Partial<PracticeSettingsLocal>,
  ): Promise<void> => {
    const next: PracticeSettingsLocal = {
      defaultPracticeMode: defaultMode,
      quickFlashDelay,
      ...patch,
    };
    // 先写入本地兜底
    setFallbackSettings(next);

    setSaving(true);
    try {
      await userSettingsApi.updateSettings(
        patch as unknown as Record<string, unknown>,
      );
    } catch (error) {
      logger.warn('[PracticeSettings] 保存到服务端失败，已暂存本地', error);
      toast.error('设置保存到云端失败，已暂存到本地');
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (value: string): void => {
    const mode = value as PracticeMode;
    setDefaultMode(mode);
    // 当配置的默认模式与上次记录不一致时，清除 last_mode 让默认模式生效
    const last = safeGetItem(PRACTICE_LAST_MODE_KEY);
    if (last && last !== mode) {
      // 不清除 last_mode，保持「记住上次选择」优先；仅作为默认值来源之一
    }
    saveSettings({ defaultPracticeMode: mode });
  };

  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;
    if (raw === '') {
      setQuickFlashDelay(0);
      return;
    }
    const val = parseInt(raw, 10);
    if (Number.isNaN(val)) return;
    setQuickFlashDelay(val);
  };

  const handleDelayBlur = (): void => {
    let val = quickFlashDelay;
    if (!Number.isFinite(val) || val < MIN_DELAY) val = MIN_DELAY;
    if (val > MAX_DELAY) val = MAX_DELAY;
    // 按步长取整
    val = Math.round(val / DELAY_STEP) * DELAY_STEP;
    if (val < MIN_DELAY) val = MIN_DELAY;
    if (val > MAX_DELAY) val = MAX_DELAY;
    if (val !== quickFlashDelay) {
      setQuickFlashDelay(val);
    }
    saveSettings({ quickFlashDelay: val });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">练习设置</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
               配置默认练习模式与速读体验
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <SettingRow
            label="默认练习模式"
            description="每次开始练习时默认选中的模式"
            control={
              <Select
                value={defaultMode}
                onValueChange={handleModeChange}
                disabled={saving && !loaded}
              >
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue placeholder="选择模式" />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <div className="border-t border-border/40" />
           <SettingRow
             label="速读自动跳转延迟"
             description="答对后自动跳到下一题的等待时间（毫秒）"
            control={
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={quickFlashDelay || ''}
                  onChange={handleDelayChange}
                  onBlur={handleDelayBlur}
                  min={MIN_DELAY}
                  max={MAX_DELAY}
                  step={DELAY_STEP}
                  className="w-28 text-right text-sm"
                  disabled={saving && !loaded}
                />
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            }
          />
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
               速读模式下，答对后会在设定延迟后自动跳转；答错则停留查看解析。
              建议范围 {MIN_DELAY}-{MAX_DELAY} ms，步长 {DELAY_STEP} ms。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeSettingsSection;
