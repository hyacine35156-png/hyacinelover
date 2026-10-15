import {
  Play,
  Pause,
  Square,
  Volume2,
  Gauge,
  FileText,
  ListChecks,
  Lightbulb,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type VoiceScope = 'question' | 'options' | 'analysis';

interface VoiceReaderProps {
  /** 是否正在朗读 */
  isSpeaking: boolean;
  /** 是否暂停 */
  isPaused: boolean;
  /** 语速 0.5 - 2 */
  rate: number;
  /** 朗读范围 */
  scope: VoiceScope;
  /** 是否支持语音，不支持时整个组件隐藏 */
  isSupported: boolean;
  /** 点击播放/暂停 */
  onPlayPause: () => void;
  /** 点击停止 */
  onStop: () => void;
  /** 调整语速 */
  onRateChange: (rate: number) => void;
  /** 调整朗读范围 */
  onScopeChange: (scope: VoiceScope) => void;
  /** 自定义类名 */
  className?: string;
}

const RATE_PRESETS: { value: number; label: string }[] = [
  { value: 0.75, label: '慢' },
  { value: 1, label: '正常' },
  { value: 1.5, label: '快' },
];

const SCOPE_OPTIONS: { value: VoiceScope; label: string; icon: typeof FileText }[] = [
  { value: 'question', label: '题干', icon: FileText },
  { value: 'options', label: '题干+选项', icon: ListChecks },
  { value: 'analysis', label: '题干+选项+解析', icon: Lightbulb },
];

const VoiceReader = ({
  isSpeaking,
  isPaused,
  rate,
  scope,
  isSupported,
  onPlayPause,
  onStop,
  onRateChange,
  onScopeChange,
  className,
}: VoiceReaderProps) => {
  if (!isSupported) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-1.5 py-1 text-xs shadow-sm backdrop-blur-sm sm:gap-1.5 sm:px-2',
          className,
        )}
      >
        {/* 播放/暂停 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onPlayPause}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-[hsl(290_75%_65%)] text-white shadow-sm transition-all duration-200 hover:brightness-105 active:scale-95"
              aria-label={isSpeaking && !isPaused ? '暂停朗读' : '开始朗读'}
            >
              {isSpeaking && !isPaused ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5 translate-x-px" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{isSpeaking && !isPaused ? '暂停' : '播放'}</p>
          </TooltipContent>
        </Tooltip>

        {/* 停止 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onStop}
              disabled={!isSpeaking && !isPaused}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="停止朗读"
            >
              <Square className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">停止</p>
          </TooltipContent>
        </Tooltip>

        <div className="mx-0.5 h-4 w-px bg-border/70" />

        {/* 语速调节 */}
        <div className="flex items-center gap-0.5 rounded-full bg-background/60 p-0.5 ring-1 ring-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                <Gauge className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">语速</p>
            </TooltipContent>
          </Tooltip>
          {RATE_PRESETS.map((preset) => {
            const active = Math.abs(rate - preset.value) < 0.01;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onRateChange(preset.value)}
                className={cn(
                  'h-6 min-w-[36px] rounded-full px-2 text-[11px] font-medium transition-all duration-200',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="mx-0.5 h-4 w-px bg-border/70" />

        {/* 朗读范围 */}
        <div className="flex items-center gap-0.5 rounded-full bg-background/60 p-0.5 ring-1 ring-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                <Volume2 className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">朗读范围</p>
            </TooltipContent>
          </Tooltip>
          {SCOPE_OPTIONS.map((opt) => {
            const active = scope === opt.value;
            const Icon = opt.icon;
            return (
              <Tooltip key={opt.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onScopeChange(opt.value)}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200',
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                    aria-label={`朗读范围：${opt.label}`}
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{opt.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default VoiceReader;
