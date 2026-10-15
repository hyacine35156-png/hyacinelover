import {
  Keyboard,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';

interface ShortcutItem {
  keys: string[];
  label: string;
}

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GENERAL_SHORTCUTS: ShortcutItem[] = [
  { keys: ['Ctrl', '1'], label: '切换到「我的题集」标签' },
  { keys: ['Ctrl', '2'], label: '切换到「收藏」标签' },
  { keys: ['Ctrl', '3'], label: '切换到「错题本」标签' },
  { keys: ['Ctrl', '4'], label: '切换到「标签」标签' },
  { keys: ['Ctrl', '5'], label: '切换到「数据统计」标签' },
  { keys: ['Ctrl', 'K'], label: '打开搜索' },
  { keys: ['Esc'], label: '关闭弹窗 / 返回上一页' },
];

const PRACTICE_SHORTCUTS: ShortcutItem[] = [
  { keys: ['A'], label: '选择选项 A' },
  { keys: ['B'], label: '选择选项 B' },
  { keys: ['C'], label: '选择选项 C' },
  { keys: ['D'], label: '选择选项 D' },
  { keys: ['E'], label: '选择选项 E' },
  { keys: ['Enter'], label: '提交答案 / 下一题' },
  { keys: ['←'], label: '上一题' },
  { keys: ['→'], label: '下一题' },
  { keys: ['F'], label: '收藏 / 取消收藏' },
  { keys: ['N'], label: '打开 / 关闭笔记' },
  { keys: ['?'], label: '显示快捷键帮助' },
];

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md bg-foreground px-2 text-[11px] font-semibold text-background shadow-sm ring-1 ring-foreground/20">
      {children}
    </kbd>
  );
}

function ShortcutRow({ item }: { item: ShortcutItem }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/40">
      <span className="text-sm text-foreground/90">{item.label}</span>
      <div className="flex flex-shrink-0 items-center gap-1">
        {item.keys.map((k, i) => (
          <span key={k + i} className="flex items-center gap-1">
            {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
            <KeyBadge>{k}</KeyBadge>
          </span>
        ))}
      </div>
    </div>
  );
}

const ShortcutsHelp = ({ open, onOpenChange }: ShortcutsHelpProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent text-primary ring-1 ring-primary/20">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base">键盘快捷键</DialogTitle>
              <p className="text-xs text-muted-foreground">
                 熟练使用快捷键，练习效率翻倍
              </p>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              通用快捷键
            </h3>
            <div className="space-y-0.5">
              {GENERAL_SHORTCUTS.map((item) => (
                <ShortcutRow key={item.label} item={item} />
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
               练习快捷键
            </h3>
            <div className="space-y-0.5">
              {PRACTICE_SHORTCUTS.map((item) => (
                <ShortcutRow key={item.label} item={item} />
              ))}
            </div>
          </section>
          <p className="text-center text-[11px] text-muted-foreground">
            提示：在输入框中打字时，字母快捷键会自动禁用
          </p>
        </DialogBody>
        {/* 底部关闭按钮占位，保持视觉平衡 */}
        <div className="border-t border-border/50 px-5 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-4 w-4" />
            关闭（Esc）
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutsHelp;
