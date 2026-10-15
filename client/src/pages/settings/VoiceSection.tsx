import { useState } from 'react';
import { Volume2, Gauge } from 'lucide-react';
import { SettingRow } from './SettingSection';
import { Switch } from '@client/src/components/ui/switch';
import { safeSetItem, safeGetItem } from '@client/src/utils/env';

const SPEED_OPTIONS = [
  { value: 'slow', label: '慢' },
  { value: 'normal', label: '正常' },
  { value: 'fast', label: '快' },
];

const READ_SCOPE_OPTIONS = [
  { value: 'question', label: '题干' },
  { value: 'questionOptions', label: '题干+选项' },
  { value: 'full', label: '题干+选项+解析' },
];

const STORAGE_PREFIX = 'hyacine_voice_';

type SpeedLevel = 'slow' | 'normal' | 'fast';
type ReadScope = 'question' | 'questionOptions' | 'full';

function getStored<T extends string>(key: string, fallback: T): T {
  const stored = safeGetItem(STORAGE_PREFIX + key);
  return (stored as T) || fallback;
}

function setStored(key: string, value: string): void {
  safeSetItem(STORAGE_PREFIX + key, value);
}

const VoiceSection = () => {
  const [speed, setSpeed] = useState<SpeedLevel>(
    () => getStored<SpeedLevel>('speed', 'normal'),
  );
  const [autoRead, setAutoRead] = useState<boolean>(
    () => getStored('auto_read', '1') === '1',
  );
  const [readScope, setReadScope] = useState<ReadScope>(
    () => getStored<ReadScope>('scope', 'question'),
  );

  const handleSpeedChange = (value: SpeedLevel): void => {
    setSpeed(value);
    setStored('speed', value);
  };

  const handleAutoReadChange = (checked: boolean): void => {
    setAutoRead(checked);
    setStored('auto_read', checked ? '1' : '0');
  };

  const handleScopeChange = (value: ReadScope): void => {
    setReadScope(value);
    setStored('scope', value);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Volume2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">语音设置</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              语速、自动朗读与朗读范围
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <SettingRow
            label="语速"
            description="语音朗读的播放速度"
            control={
              <div className="inline-flex items-center rounded-lg bg-muted p-1 ring-1 ring-border/40">
                {SPEED_OPTIONS.map((option) => {
                  const isActive = speed === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSpeedChange(option.value as SpeedLevel)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-card text-primary shadow-sm ring-1 ring-border/60'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            }
          />
          <div className="border-t border-border/40" />
          <SettingRow
            label="自动朗读解析"
            description="查看解析时自动开始朗读"
            control={
              <Switch
                checked={autoRead}
                onCheckedChange={handleAutoReadChange}
              />
            }
          />
          <div className="border-t border-border/40" />
          <SettingRow
            label="朗读范围"
            description="每次朗读包含的内容范围"
            control={
              <div className="inline-flex items-center rounded-lg bg-muted p-1 ring-1 ring-border/40">
                {READ_SCOPE_OPTIONS.map((option) => {
                  const isActive = readScope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleScopeChange(option.value as ReadScope)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-card text-primary shadow-sm ring-1 ring-border/60'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
};

export default VoiceSection;
