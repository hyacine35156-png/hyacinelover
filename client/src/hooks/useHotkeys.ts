import { useEffect, useRef } from 'react';

export type HotkeyHandler = (e: KeyboardEvent) => void;
export type HotkeyMap = Record<string, HotkeyHandler>;

/**
 * 判断当前焦点是否在可输入元素中（快捷键应被过滤）
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * 规范化快捷键 key 字符串，支持修饰符与单键组合。
 * 格式示例：
 *   "a"          -> 单键 A
 *   "A"          -> 单键 A（大小写不敏感，统一转大写匹配）
 *   "ctrl+1"     -> Ctrl/Cmd + 数字 1（自动适配 mac 的 Cmd）
 *   "cmd+k"      -> Ctrl/Cmd + K（同上，ctrl 与 cmd 等价）
 *   "arrowleft"  -> 方向左键
 *   "?"          -> 问号键
 */
function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function parseHotkey(hotkey: string): {
  keys: string[];
  needsCtrlOrCmd: boolean;
} {
  const parts = hotkey.split('+').map((p) => p.trim().toLowerCase());
  const modKeys = new Set(['ctrl', 'cmd', 'meta', 'mod']);
  const needsCtrlOrCmd = parts.some((p) => modKeys.has(p));
  const keys = parts.filter((p) => !modKeys.has(p));
  return { keys, needsCtrlOrCmd };
}

function matchesEvent(hotkey: string, e: KeyboardEvent): boolean {
  const { keys, needsCtrlOrCmd } = parseHotkey(hotkey);
  if (needsCtrlOrCmd && !(e.ctrlKey || e.metaKey)) return false;
  if (!needsCtrlOrCmd && (e.ctrlKey || e.metaKey || e.altKey)) return false;
  // 排除 Shift 修饰（? 键除外，因为它本身需要 Shift+/）
  const needsShift = keys.some((k) => k === '?' || /^[A-Z]$/.test(k));
  if (!needsShift && e.shiftKey && !keys.some((k) => k === '?')) return false;

  const eventKey = e.key.toLowerCase();
  if (keys.length === 0) return false;

  // 特殊键：数字键 1-5，key 本身就是 "1".."5"
  // 字母键：转成小写后比较
  // 方向键等：直接比较
  return keys.some((k) => {
    // 处理 ?（shift+/ 的结果，key 直接是 "?"）
    if (k === '?') return eventKey === '?';
    // 方向键等
    if (k.startsWith('arrow')) return eventKey === k;
    // enter / escape 等
    if (k === 'enter' || k === 'return') return eventKey === 'enter';
    if (k === 'esc' || k === 'escape') return eventKey === 'escape';
    // 字母 / 数字 / 符号
    return eventKey === k;
  });
}

interface UseHotkeysOptions {
  /** 是否启用，默认 true；可用于条件性挂载 */
  enabled?: boolean;
  /** 是否在可输入元素（input/textarea/contentEditable）中也触发，默认 false */
  allowInEditable?: boolean;
  /** 事件阶段，默认 false（冒泡） */
  capture?: boolean;
}

/**
 * useHotkeys - 简洁的键盘快捷键 hook
 *
 * @param hotkeys 快捷键映射，key 是快捷键描述，value 是处理函数
 * @param options 配置项
 *
 * 支持的快捷键格式：
 *   - 单键："a"、"1"、"enter"、"escape"、"arrowleft"、"arrowright"、"?"
 *   - 带修饰符："ctrl+k"、"cmd+1"（ctrl 与 cmd 等价，自动跨平台适配）
 *
 * 注意：默认在 input/textarea/contentEditable 中不触发，可通过 allowInEditable 打开。
 */
export function useHotkeys(
  hotkeys: HotkeyMap,
  options: UseHotkeysOptions = {},
): void {
  const { enabled = true, allowInEditable = false, capture = false } = options;

  // 用 ref 保存最新的 hotkeys，避免 effect 频繁重新绑定
  const hotkeysRef = useRef<HotkeyMap>(hotkeys);
  hotkeysRef.current = hotkeys;

  const allowInEditableRef = useRef<boolean>(allowInEditable);
  allowInEditableRef.current = allowInEditable;

  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!allowInEditableRef.current && isEditableTarget(e.target)) {
        return;
      }
      const current = hotkeysRef.current;
      for (const hotkey of Object.keys(current)) {
        if (matchesEvent(hotkey, e)) {
          const handler = current[hotkey];
          if (handler) {
            e.preventDefault();
            handler(e);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, capture);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, capture);
    };
  }, [enabled, capture]);
}

export default useHotkeys;
