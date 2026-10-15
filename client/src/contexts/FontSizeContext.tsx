import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { safeSetItem, safeGetItem } from '@client/src/utils/env';

export type FontSizeLevel = 'sm' | 'md' | 'lg' | 'xl';

const STORAGE_KEY = 'hyacine_font_size';
const QUESTION_STORAGE_KEY = 'hyacine_question_font_size';
const DESKTOP_DEFAULT: FontSizeLevel = 'lg';
const MOBILE_DEFAULT: FontSizeLevel = 'md';

function getDefaultFontSize(): FontSizeLevel {
  if (typeof window === 'undefined') return DESKTOP_DEFAULT;
  return window.innerWidth >= 768 ? DESKTOP_DEFAULT : MOBILE_DEFAULT;
}

const FONT_SIZE_PX: Record<FontSizeLevel, string> = {
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
};

interface FontSizeContextValue {
  fontSize: FontSizeLevel;
  questionFontSize: FontSizeLevel;
  setFontSize: (size: FontSizeLevel) => void;
  setQuestionFontSize: (size: FontSizeLevel) => void;
}

const FontSizeContext = createContext<FontSizeContextValue | undefined>(
  undefined,
);

function isValidFontSize(value: string | null): value is FontSizeLevel {
  return value === 'sm' || value === 'md' || value === 'lg' || value === 'xl';
}

function applyFontSizeToDom(size: FontSizeLevel): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.fontSize = FONT_SIZE_PX[size];
  root.setAttribute('data-font-size', size);
}

interface FontSizeProviderProps {
  children: ReactNode;
}

const FontSizeProvider = ({ children }: FontSizeProviderProps) => {
  const [fontSize, setFontSizeState] = useState<FontSizeLevel>(() => {
    const stored = safeGetItem(STORAGE_KEY);
    return isValidFontSize(stored) ? stored : getDefaultFontSize();
  });

  const [questionFontSize, setQuestionFontSizeState] = useState<FontSizeLevel>(
    () => {
      const stored = safeGetItem(QUESTION_STORAGE_KEY);
      if (isValidFontSize(stored)) return stored;
      const globalStored = safeGetItem(STORAGE_KEY);
      return isValidFontSize(globalStored) ? globalStored : getDefaultFontSize();
    },
  );

  // Apply global font size
  useEffect(() => {
    applyFontSizeToDom(fontSize);
    safeSetItem(STORAGE_KEY, fontSize);
  }, [fontSize]);

  // Apply question font size via CSS variable on html
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty(
      '--question-font-size',
      FONT_SIZE_PX[questionFontSize],
    );
    safeSetItem(QUESTION_STORAGE_KEY, questionFontSize);
  }, [questionFontSize]);

  // 监听设置同步事件：从后端拉取到新设置时自动应用字号
  useEffect(() => {
    const handleSynced = (event: Event): void => {
      const detail = (
        event as CustomEvent<{
          fontSize?: FontSizeLevel;
          questionFontSize?: FontSizeLevel;
        }>
      ).detail;
      if (detail?.fontSize && detail.fontSize !== fontSize) {
        setFontSizeState(detail.fontSize);
      }
      if (detail?.questionFontSize && detail.questionFontSize !== questionFontSize) {
        setQuestionFontSizeState(detail.questionFontSize);
      }
    };
    window.addEventListener('settings:synced', handleSynced);
    return () => window.removeEventListener('settings:synced', handleSynced);
  }, [fontSize, questionFontSize]);

  const setFontSize = (size: FontSizeLevel): void => {
    setFontSizeState(size);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('settings:changed', {
        detail: { fontSize: size },
      }));
    }
  };

  const setQuestionFontSize = (size: FontSizeLevel): void => {
    setQuestionFontSizeState(size);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('settings:changed', {
        detail: { questionFontSize: size },
      }));
    }
  };

  const value: FontSizeContextValue = {
    fontSize,
    questionFontSize,
    setFontSize,
    setQuestionFontSize,
  };

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
};

const useFontSize = (): FontSizeContextValue => {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
};

export { FontSizeProvider, useFontSize, FONT_SIZE_PX };
