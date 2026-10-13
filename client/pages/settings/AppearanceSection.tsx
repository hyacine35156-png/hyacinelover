import { Sun, Moon, Monitor, Type } from 'lucide-react';
import { SettingSection, SettingRow } from './SettingSection';
import { Switch } from '@client/src/components/ui/switch';
import { useTheme, type Theme } from '@client/src/contexts/ThemeContext';
import {
  useFontSize,
  type FontSizeLevel,
} from '@client/src/contexts/FontSizeContext';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

const FONT_OPTIONS: { value: FontSizeLevel; label: string }[] = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '中' },
  { value: 'lg', label: '大' },
  { value: 'xl', label: '特大' },
];

const AppearanceSection = () => {
  const { theme, setTheme } = useTheme();
  const { fontSize, setFontSize, questionFontSize, setQuestionFontSize } =
    useFontSize();

  return (
    <div className="space-y-4">
      <SettingSection
        title="外观设置"
        description="主题模式与字体大小，打造舒适的阅读体验"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              主题模式
            </p>
            <div className="inline-flex rounded-lg bg-muted p-1 ring-1 ring-border/40">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-card text-primary shadow-sm ring-1 ring-border/60'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    }`}
                    aria-label={option.label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingSection>

      <SettingSection
        title="字体大小"
        description="调整界面文字大小，题目内容可单独调节"
        icon={<Type className="h-4 w-4" />}
      >
        <div className="w-full space-y-4">
          <SettingRow
            label="全局字号"
            description="影响整个应用的文字大小"
            control={
              <div className="inline-flex rounded-lg bg-muted p-1 ring-1 ring-border/40">
                {FONT_OPTIONS.map((option) => {
                  const isActive = fontSize === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFontSize(option.value)}
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
            label="题文字号"
            description="单独调大题目内容的文字"
            control={
              <div className="inline-flex rounded-lg bg-muted p-1 ring-1 ring-border/40">
                {FONT_OPTIONS.map((option) => {
                  const isActive = questionFontSize === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setQuestionFontSize(option.value)}
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
        </div>
      </SettingSection>
    </div>
  );
};

export default AppearanceSection;
