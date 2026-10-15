import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { safeGetItem, safeSetItem } from '@client/src/utils/env';

const RATE_STORAGE_KEY = 'hyacine_voice_rate';
const SCOPE_STORAGE_KEY = 'hyacine_voice_scope';

export type VoiceScope = 'question' | 'options' | 'analysis';

interface UseSpeechOptions {
  /** 默认语速，0.5 - 2，默认 1 */
  defaultRate?: number;
  /** 默认朗读范围 */
  defaultScope?: VoiceScope;
}

interface UseSpeechReturn {
  /** 浏览器是否支持 SpeechSynthesis */
  isSupported: boolean;
  /** 是否正在朗读 */
  isSpeaking: boolean;
  /** 是否处于暂停状态 */
  isPaused: boolean;
  /** 当前语速 0.5 - 2 */
  rate: number;
  /** 设置语速 */
  setRate: (rate: number) => void;
  /** 当前朗读范围 */
  scope: VoiceScope;
  /** 设置朗读范围 */
  setScope: (scope: VoiceScope) => void;
  /** 开始朗读 */
  speak: (text: string) => void;
  /** 暂停 */
  pause: () => void;
  /** 继续 */
  resume: () => void;
  /** 停止 */
  stop: () => void;
}

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  const synth = window.speechSynthesis;
  if (!synth) return null;
  return synth;
}

/**
 * useSpeech - 基于 Web Speech API 的语音朗读 hook
 *
 * 提供 speak/pause/resume/stop 控制，以及语速与朗读范围持久化。
 * 浏览器不支持时 isSupported 为 false，所有操作为 no-op，不会报错。
 */
export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const { defaultRate = 1, defaultScope = 'options' } = options;

  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [rate, setRateState] = useState<number>(defaultRate);
  const [scope, setScopeState] = useState<VoiceScope>(defaultScope);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 初始化：检测支持性 + 从 localStorage 读取偏好
  useEffect(() => {
    const synth = getSpeechSynthesis();
    if (!synth) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    // 恢复语速
    const savedRate = safeGetItem(RATE_STORAGE_KEY);
    if (savedRate) {
      const parsed = Number(savedRate);
      if (!Number.isNaN(parsed) && parsed >= 0.5 && parsed <= 2) {
        setRateState(parsed);
      }
    }

    // 恢复朗读范围
    const savedScope = safeGetItem(SCOPE_STORAGE_KEY) as VoiceScope | null;
    if (savedScope && ['question', 'options', 'analysis'].includes(savedScope)) {
      setScopeState(savedScope);
    }
  }, []);

  // 清理：组件卸载时停止朗读
  useEffect(() => {
    return () => {
      const synth = getSpeechSynthesis();
      if (synth && synth.speaking) {
        synth.cancel();
      }
    };
  }, []);

  const setRate = useCallback((nextRate: number): void => {
    const clamped = Math.min(2, Math.max(0.5, nextRate));
    setRateState(clamped);
    safeSetItem(RATE_STORAGE_KEY, String(clamped));

    // 若正在朗读，立即更新语速
    const synth = getSpeechSynthesis();
    const utterance = utteranceRef.current;
    if (synth && utterance && synth.speaking) {
      utterance.rate = clamped;
      // 重新触发（部分浏览器需要 cancel 再 speak 才能生效）
      try {
        synth.pause();
        utterance.rate = clamped;
        synth.resume();
      } catch (err) {
        logger.warn('[Speech] 更新语速失败', err);
      }
    }
  }, []);

  const setScope = useCallback((nextScope: VoiceScope): void => {
    setScopeState(nextScope);
    safeSetItem(SCOPE_STORAGE_KEY, nextScope);
  }, []);

  const speak = useCallback(
    (text: string): void => {
      const synth = getSpeechSynthesis();
      if (!synth) return;
      if (!text || !text.trim()) return;

      // 先停掉正在朗读的
      if (synth.speaking || synth.paused) {
        synth.cancel();
      }

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onstart = (): void => {
          setIsSpeaking(true);
          setIsPaused(false);
        };
        utterance.onend = (): void => {
          setIsSpeaking(false);
          setIsPaused(false);
          utteranceRef.current = null;
        };
        utterance.onerror = (e): void => {
          logger.warn('[Speech] 朗读出错', e.error);
          setIsSpeaking(false);
          setIsPaused(false);
          utteranceRef.current = null;
        };
        utterance.onpause = (): void => {
          setIsPaused(true);
        };
        utterance.onresume = (): void => {
          setIsPaused(false);
        };

        utteranceRef.current = utterance;
        synth.speak(utterance);
      } catch (err) {
        logger.error('[Speech] 创建朗读失败', err);
        setIsSpeaking(false);
        setIsPaused(false);
      }
    },
    [rate],
  );

  const pause = useCallback((): void => {
    const synth = getSpeechSynthesis();
    if (synth && synth.speaking && !synth.paused) {
      synth.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback((): void => {
    const synth = getSpeechSynthesis();
    if (synth && synth.paused) {
      synth.resume();
      setIsPaused(false);
    }
  }, []);

  const stop = useCallback((): void => {
    const synth = getSpeechSynthesis();
    if (synth) {
      synth.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
    }
  }, []);

  return {
    isSupported,
    isSpeaking,
    isPaused,
    rate,
    setRate,
    scope,
    setScope,
    speak,
    pause,
    resume,
    stop,
  };
}

export default useSpeech;
