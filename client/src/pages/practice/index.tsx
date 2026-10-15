import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useNavigate } from '@client/src/utils/router';
import {
  ArrowLeft,
  Clock,
  Trophy,
  Loader2,
  Save,
  Check,
  Keyboard,
  CloudOff,
  Cloud,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { safeGetItem, safeSetItem } from '@client/src/utils/env';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@client/src/components/ui/alert-dialog';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@client/src/components/ui/card';

import { questionBankApi, practiceRecordApi, checkinApi, questionApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { QuestionItem, QuestionWithFavorite, SubQuestion, PracticeAnswerItem, PracticeMode } from '@shared/api.interface';
import {
  getQuestionsByBank,
  saveOfflineRecord,
  openDB as openOfflineDB,
  getDownloadedBanks,
} from '@client/src/utils/offline-db';

import QuestionNavigator from './QuestionNavigator';
import PracticeQuestionView from './PracticeQuestionView';
import QuestionComments from '@client/src/components/question-comments/QuestionComments';
import QuestionActionBar, { type QuestionActionBarHandle } from '@client/src/components/question-action-bar/QuestionActionBar';
import ShortcutsHelp from '@client/src/components/ShortcutsHelp';
import VoiceReader from '@client/src/components/VoiceReader';
import { useHotkeys } from '@client/src/hooks/useHotkeys';
import { useSpeech } from '@client/src/hooks/useSpeech';

interface FlatQuestionItem extends QuestionItem {
  isFavorited: boolean;
  wrongCount: number;
  mastered: boolean;
  subIndex: number;
  subTotal: number;
  subQuestion?: SubQuestion;
  b1GroupId: string | null;
}

const GUEST_PRACTICE_KEY = 'guest_practice_session';

interface GuestPracticeSession {
  bankId: string;
  bankName: string;
  questions: QuestionItem[];
}

function getGuestPracticeSession(): GuestPracticeSession | null {
  try {
    const raw = sessionStorage.getItem(GUEST_PRACTICE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestPracticeSession;
  } catch {
    return null;
  }
}

function questionsAsWithFavorite(items: QuestionItem[]): QuestionWithFavorite[] {
  return items.map((q) => ({
    ...q,
    isFavorited: false,
    wrongCount: 0,
    mastered: false,
  }));
}

const buildFlatQuestions = (items: QuestionWithFavorite[]): FlatQuestionItem[] => {
  const result: FlatQuestionItem[] = [];
  for (const q of items) {
    if (q.questionType === 'b1' && q.subQuestions && q.subQuestions.length > 0) {
      q.subQuestions.forEach((sq, idx) => {
        result.push({
          ...q,
          correctAnswers: [],
          analysis: sq.analysis,
          isFavorited: q.isFavorited,
          wrongCount: q.wrongCount,
          mastered: q.mastered,
          subIndex: idx,
          subTotal: q.subQuestions.length,
          subQuestion: sq,
          b1GroupId: q.id,
        });
      });
    } else {
      result.push({
        ...q,
        isFavorited: q.isFavorited,
        wrongCount: q.wrongCount,
        mastered: q.mastered,
        subIndex: 0,
        subTotal: 1,
        b1GroupId: null,
      });
    }
  }
  return result;
};

const buildGroupedAnswers = (flat: FlatQuestionItem[], flatAnswers: number[][], flatSubmitted: boolean[]): { answers: number[][]; submitted: boolean[] } => {
  const answerMap = new Map<string, number[]>();
  const submittedMap = new Map<string, boolean>();
  const ids = new Set<string>();
  for (let i = 0; i < flat.length; i += 1) {
    const q = flat[i];
    ids.add(q.id);
    if (q.questionType === 'b1' && q.b1GroupId) {
      const existing = answerMap.get(q.id) || [];
      if (flatSubmitted[i]) {
        const userAns = flatAnswers[i][0];
        if (userAns !== undefined) {
          const sqIdx = q.subIndex;
          existing[sqIdx] = userAns;
          answerMap.set(q.id, existing);
          submittedMap.set(q.id, true);
        }
      }
    } else if (flatSubmitted[i]) {
      answerMap.set(q.id, flatAnswers[i] || []);
      submittedMap.set(q.id, true);
    }
  }
  const answers: number[][] = [];
  const submitted: boolean[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < flat.length; i += 1) {
    const q = flat[i];
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    answers.push(answerMap.get(q.id) || []);
    submitted.push(Boolean(submittedMap.get(q.id)));
  }
  return { answers, submitted };
};

const shuffleArray = <T,>(arr: T[]): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const PracticePage = () => {
  const { bankId } = useParams<{ bankId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [questions, setQuestions] = useState<QuestionWithFavorite[]>([]);
  const [flatQuestions, setFlatQuestions] = useState<FlatQuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allAnswers, setAllAnswers] = useState<number[][]>([]);
  const [submitted, setSubmitted] = useState<boolean[]>([]);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [questionDurations, setQuestionDurations] = useState<number[]>([]);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [orderMode, setOrderModeState] = useState<'original' | 'shuffle'>('original');
  const [practiceMode, setPracticeModeState] = useState<PracticeMode>(() => {
    if (typeof window === 'undefined') return 'basic';
    const urlParams = new URLSearchParams(window.location.search);
    const modeFromUrl = urlParams.get('mode') as PracticeMode | null;
    const savedMode = safeGetItem('practice_last_mode') as PracticeMode | null;
    const rawMode = modeFromUrl || savedMode || 'basic';
    const validModes: PracticeMode[] = ['basic', 'recite', 'quick'];
    return validModes.includes(rawMode) ? rawMode : 'basic';
  });
  const quickAutoJumpTimerRef = useRef<number | null>(null);
  // 离线模式
  const [isOffline, setIsOffline] = useState(false);
  const [bankName, setBankName] = useState('');
  const [justReconnected, setJustReconnected] = useState(false);
  // 单题计时
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [questionElapsed, setQuestionElapsed] = useState(0);
  const { isGuest } = useAuth();

  const actionBarRef = useRef<QuestionActionBarHandle>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const setOrderMode = (mode: 'original' | 'shuffle') => {
    setOrderModeState(mode);
    safeSetItem('practice_order_mode', mode);
  };

  const setPracticeMode = useCallback(async (mode: PracticeMode) => {
    const prevMode = practiceMode;
    setPracticeModeState(mode);
    safeSetItem('practice_last_mode', mode);
    setAllAnswers((prev) => {
      const next = [...prev];
      if (!submitted[currentIndex]) {
        next[currentIndex] = [];
      }
      return next;
    });
    if (
      !isGuest
      && !isOffline
      && bankId
      && (mode === 'basic' || mode === 'quick')
      && prevMode === 'recite'
      && !recordId
    ) {
      try {
        const session = await practiceRecordApi.createSession({
          bankId,
          totalCount: questions.length,
          practiceMode: mode,
        });
        setRecordId(session.recordId);
        setStartedAt(new Date(session.startedAt).getTime());
      } catch (err) {
        logger.error('切换模式后创建练习会话失败', err);
        toast.error('创建练习会话失败，请稍后重试');
      }
    }
  }, [practiceMode, currentIndex, submitted, isGuest, isOffline, bankId, recordId, questions.length]);

  const saveTimerRef = useRef<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentQuestion = flatQuestions[currentIndex];
  const selectedAnswers = allAnswers[currentIndex] || [];
  const isSubmitted = submitted[currentIndex] || false;
  const showAnswer = isSubmitted || practiceMode === 'recite';
  const showCorrectness = isSubmitted;

  // 语音读题
  const {
    isSupported: voiceSupported,
    isSpeaking,
    isPaused,
    rate: voiceRate,
    scope: voiceScope,
    setRate: setVoiceRate,
    setScope: setVoiceScope,
    speak: voiceSpeak,
    pause: voicePause,
    resume: voiceResume,
    stop: voiceStop,
  } = useSpeech();

  // 根据当前题目和朗读范围生成朗读文本
  const buildSpeakText = useCallback((): string => {
    if (!currentQuestion) return '';
    const q = currentQuestion;
    const stem =
      q.questionType === 'b1' && q.subQuestion
        ? `第 ${q.subIndex + 1} 小题。${q.subQuestion.content}`
        : q.content;
    if (voiceScope === 'question') {
      return stem;
    }
    const optionsText = q.options
      .map((opt) => `选项 ${opt.label}，${opt.text}`)
      .join('。');
    if (voiceScope === 'options') {
      return `${stem}。${optionsText}`;
    }
    // analysis
    if (showAnswer && q.analysis) {
      const correctText =
        q.questionType === 'b1' && q.subQuestion
          ? `正确答案是 ${q.subQuestion.correctAnswer}。`
          : `正确答案是 ${q.correctAnswers
              .map((i) => q.options[i]?.label)
              .join('、')}。`;
      return `${stem}。${optionsText}。${correctText}答案解析：${q.analysis}`;
    }
    return `${stem}。${optionsText}`;
  }, [currentQuestion, voiceScope, showAnswer]);

  const handleVoicePlayPause = useCallback((): void => {
    if (!voiceSupported) return;
    if (isSpeaking && !isPaused) {
      voicePause();
    } else if (isPaused) {
      voiceResume();
    } else {
      const text = buildSpeakText();
      if (text) voiceSpeak(text);
    }
  }, [voiceSupported, isSpeaking, isPaused, voicePause, voiceResume, voiceSpeak, buildSpeakText]);

  // 切题/切换范围时停止朗读
  useEffect(() => {
    if (voiceSupported && isSpeaking) {
      voiceStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, voiceScope]);

  const correctFlags = useMemo(() => {
    return flatQuestions.map((q, idx) => {
      if (!submitted[idx]) return false;
      const userAnswers = allAnswers[idx] || [];
      if (q.questionType === 'b1') {
        if (userAnswers.length === 0 || !q.subQuestion) return false;
        const correctIdx = q.options.findIndex((o) => o.label === q.subQuestion!.correctAnswer);
        return userAnswers[0] === correctIdx;
      }
      const userSorted = [...userAnswers].sort();
      const correctSorted = [...q.correctAnswers].sort();
      return (
        userSorted.length === correctSorted.length &&
        userSorted.every((v, i) => v === correctSorted[i])
      );
    });
  }, [flatQuestions, submitted, allAnswers]);

  const correctCount = useMemo(
    () => correctFlags.filter(Boolean).length,
    [correctFlags],
  );

  const getTypeAbbr = (t: string): string => {
    if (t === 'single') return 'A1';
    if (t === 'multiple') return 'X';
    return 'B1';
  };

  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of flatQuestions) {
      counts[q.questionType] = (counts[q.questionType] || 0) + 1;
    }
    return counts;
  }, [flatQuestions]);

  const typeSummary = useMemo(() => {
    const parts: string[] = [];
    if (typeDistribution.single) parts.push('A1');
    if (typeDistribution.multiple) parts.push('X');
    if (typeDistribution.b1) parts.push('B1');
    return parts.join('·');
  }, [typeDistribution]);

  const buildGroupedSavePayload = useCallback(() => {
    const seen = new Set<string>();
    const payloads: { questionId: string; questionIndex: number; userAnswers: number[]; isCorrect: boolean; durationSeconds: number }[] = [];
    for (let i = 0; i < flatQuestions.length; i += 1) {
      const q = flatQuestions[i];
      if (seen.has(q.id)) continue;
      if (q.questionType === 'b1') {
        const groupItems = flatQuestions.filter((f) => f.id === q.id);
        const anySub = groupItems.some((g) => submitted[flatQuestions.indexOf(g)]);
        if (!anySub) {
          seen.add(q.id);
          continue;
        }
        const userAnswers: number[] = [];
        let allCorrect = true;
        let hasUnanswered = false;
        for (const g of groupItems) {
          const gIdx = flatQuestions.indexOf(g);
          const ans = allAnswers[gIdx] || [];
          const isSubSubmitted = submitted[gIdx];
          const val = isSubSubmitted ? (ans[0] ?? -1) : -1;
          userAnswers.push(val);
          if (!isSubSubmitted) {
            hasUnanswered = true;
          } else {
            const correctIdx = q.options.findIndex((o) => o.label === g.subQuestion!.correctAnswer);
            if (val !== correctIdx) allCorrect = false;
          }
        }
         payloads.push({
           questionId: q.id,
           questionIndex: questions.findIndex((qq) => qq.id === q.id),
           userAnswers,
           isCorrect: hasUnanswered ? false : allCorrect,
           durationSeconds: questionDurations[i] || 0,
         });
        seen.add(q.id);
      } else {
        if (!submitted[i]) continue;
        const userAnswers = allAnswers[i] || [];
        const userSorted = [...userAnswers].sort();
        const correctSorted = [...q.correctAnswers].sort();
        const isCorrect =
          userSorted.length === correctSorted.length &&
          userSorted.every((v, j) => v === correctSorted[j]);
         payloads.push({
           questionId: q.id,
           questionIndex: questions.findIndex((qq) => qq.id === q.id),
           userAnswers: userSorted,
           isCorrect,
           durationSeconds: questionDurations[i] || 0,
         });
        seen.add(q.id);
      }
    }
    return payloads;
   }, [flatQuestions, questions, submitted, allAnswers, questionDurations]);

  const saveAllProgress = useCallback(async () => {
    if (!recordId || flatQuestions.length === 0) return { success: false };
    try {
      const payloads = buildGroupedSavePayload();
      const res = await practiceRecordApi.saveBatchProgress({
        recordId,
        currentIndex: currentIndex,
        answers: payloads,
        durationSeconds: Math.floor((Date.now() - startedAt) / 1000),
      });
      return { success: !!res.success };
    } catch (err) {
      logger.error('保存作答进度失败', err);
      return { success: false };
    }
  }, [recordId, flatQuestions, buildGroupedSavePayload, currentQuestion, questions, startedAt]);

  const handleManualSave = useCallback(async () => {
    if (!recordId || saving) return;
    setSaving(true);
    setSaved(false);
    const { success } = await saveAllProgress();
    setSaving(false);
    if (success) {
      setSaved(true);
      toast.success('进度已保存');
      window.setTimeout(() => setSaved(false), 2000);
    } else {
      toast.error('保存失败，请稍后重试');
    }
  }, [recordId, saving, saveAllProgress]);

  const handleClearRecords = useCallback(async () => {
    if (!bankId) return;
    setClearing(true);
    try {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (quickAutoJumpTimerRef.current) {
        window.clearTimeout(quickAutoJumpTimerRef.current);
        quickAutoJumpTimerRef.current = null;
      }

      const subsequentIds: string[] = [];
      const seen = new Set<string>();
      for (let i = currentIndex; i < flatQuestions.length; i += 1) {
        const q = flatQuestions[i];
        if (seen.has(q.id)) continue;
        subsequentIds.push(q.id);
        seen.add(q.id);
      }

      if (!isGuest && recordId) {
        await practiceRecordApi.clearSubsequentAnswers({
          recordId,
          questionIds: subsequentIds,
          currentIndex,
        });
      }

      setAllAnswers((prev) => {
        const next = prev.map((a) => [...a]);
        for (let i = currentIndex; i < next.length; i += 1) {
          next[i] = [];
        }
        return next;
      });
      setSubmitted((prev) => {
        const next = [...prev];
        for (let i = currentIndex; i < next.length; i += 1) {
          next[i] = false;
        }
        return next;
      });
      setShowResult(false);
      setStartedAt(Date.now());
      setElapsed(0);
      setQuestionStartTime(Date.now());
      setQuestionElapsed(0);
      setClearDialogOpen(false);
      toast.success('后续答题记录已清除');
    } catch (err) {
      logger.error('清除后续答题记录失败', err);
      toast.error('清除失败，请稍后重试');
    } finally {
      setClearing(false);
    }
  }, [bankId, isGuest, recordId, flatQuestions, currentIndex]);

  const scheduleSave = useCallback(() => {
    saveAllProgress();
  }, [saveAllProgress]);

  useEffect(() => {
    if (!bankId) return;
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const savedPref = safeGetItem('practice_order_mode') as 'original' | 'shuffle' | null;
        const initialOrder: 'original' | 'shuffle' = savedPref === 'shuffle' ? 'shuffle' : 'original';
        setOrderMode(initialOrder);

        let items: QuestionWithFavorite[];

        if (isGuest && bankId.startsWith('guest-')) {
          // 游客随机抽题模式：从 sessionStorage 读取
          const sessionData = getGuestPracticeSession();
          if (!sessionData || sessionData.bankId !== bankId) {
            throw new Error('游客作答会话已失效，请重新抽题');
          }
          items = questionsAsWithFavorite(sessionData.questions);
        } else if (isGuest) {
          // 游客直接访问公共题集
          const res = await questionBankApi.getPublicBankQuestions(bankId);
          items = questionsAsWithFavorite(res.items);
        } else {
          const res = await questionBankApi.getQuestionsWithState(bankId);
          items = res.items;
        }

        if (initialOrder === 'shuffle') {
          items = shuffleArray([...items]);
        }
        const flatItems = buildFlatQuestions(items);
        setQuestions(items);
        setFlatQuestions(flatItems);
        setAllAnswers(new Array(flatItems.length).fill(null).map(() => []));
        setSubmitted(new Array(flatItems.length).fill(false));
        setQuestionDurations(new Array(flatItems.length).fill(0));

        if (!isGuest) {
          try {
            setRestoring(true);
            const active = await practiceRecordApi.getActiveSession(bankId);
             if (active && active.answers.length > 0 && practiceMode !== 'recite') {
              const flatItemsForRestore = buildFlatQuestions(items);
              const flatSubmitted = new Array(flatItemsForRestore.length).fill(false);
              const flatAnswers: number[][] = new Array(flatItemsForRestore.length)
                .fill(null)
                .map(() => []);
              const answerMap = new Map<string, number[]>();
              for (const a of active.answers) {
                answerMap.set(a.questionId, a.userAnswers);
              }
              for (let i = 0; i < flatItemsForRestore.length; i += 1) {
                const fq = flatItemsForRestore[i];
                const userAnswers = answerMap.get(fq.id);
                if (!userAnswers) continue;
                if (fq.questionType === 'b1') {
                  const subAns = userAnswers[fq.subIndex];
                  if (subAns !== undefined) {
                    flatAnswers[i] = [subAns];
                    flatSubmitted[i] = true;
                  }
                } else {
                  flatAnswers[i] = userAnswers;
                  flatSubmitted[i] = true;
                }
              }
              setSubmitted(flatSubmitted);
              setAllAnswers(flatAnswers);
              setRecordId(active.recordId);
              setStartedAt(new Date(active.startedAt).getTime());
               const origIdx =
                 active.currentIndex >= 0 && active.currentIndex < items.length
                   ? active.currentIndex
                   : 0;
               const targetOrigId = items[origIdx]?.id;
               let targetFlatIdx = 0;
               for (let i = 0; i < flatItemsForRestore.length; i += 1) {
                 if (flatItemsForRestore[i].id === targetOrigId) {
                   targetFlatIdx = i;
                   break;
                 }
               }
               if (active.currentIndex >= flatItemsForRestore.length) {
                 targetFlatIdx = Math.min(active.currentIndex, flatItemsForRestore.length - 1);
               }
               setCurrentIndex(targetFlatIdx);
               const restoredFlat = flatItemsForRestore[targetFlatIdx];
               const groupDisplayIdx = items.findIndex((it) => it.id === restoredFlat?.id) + 1;
               let progressLabel = `第 ${groupDisplayIdx} 题`;
               if (restoredFlat?.questionType === 'b1' && restoredFlat.subTotal > 1) {
                 progressLabel += ` · 第 ${restoredFlat.subIndex + 1} 小题`;
               }
               toast(`已恢复到${progressLabel}进度`);
             } else if (practiceMode !== 'recite') {
               const session = await practiceRecordApi.createSession({
                 bankId,
                 totalCount: items.length,
                 practiceMode,
               });
               setRecordId(session.recordId);
               setStartedAt(new Date(session.startedAt).getTime());
             } else {
               setRecordId(null);
               setStartedAt(Date.now());
             }
          } catch (err) {
            logger.error('恢复/创建练习会话失败', err);
            setStartedAt(Date.now());
          } finally {
            setRestoring(false);
          }
        } else {
          setRecordId(null);
          setStartedAt(Date.now());
        }
      } catch (error) {
        logger.error('加载题目失败，尝试离线加载', error);

        // 离线降级：尝试从 IndexedDB 加载
        if (!isGuest && bankId) {
          try {
            await openOfflineDB();
            const [localQuestions, localBanks] = await Promise.all([
              getQuestionsByBank(bankId),
              getDownloadedBanks(),
            ]);
            if (localQuestions.length > 0) {
              const bankInfo = localBanks.find((b) => b.id === bankId);
              if (bankInfo) setBankName(bankInfo.name);
              const savedPref = safeGetItem('practice_order_mode') as 'original' | 'shuffle' | null;
              const initialOrder: 'original' | 'shuffle' = savedPref === 'shuffle' ? 'shuffle' : 'original';
              let items: QuestionWithFavorite[] = questionsAsWithFavorite(localQuestions);
              if (initialOrder === 'shuffle') {
                items = shuffleArray([...items]);
              }
              const flatItems = buildFlatQuestions(items);
              setQuestions(items);
              setFlatQuestions(flatItems);
              setAllAnswers(new Array(flatItems.length).fill(null).map(() => []));
              setSubmitted(new Array(flatItems.length).fill(false));
              setRecordId(null);
              setStartedAt(Date.now());
              setIsOffline(true);
              toast.warning('当前处于离线模式，使用本地缓存作答');
              setLoading(false);
              return;
            }
          } catch (offlineErr) {
            logger.error('离线加载题目也失败', offlineErr);
          }
        }

        toast.error('加载题目失败');
      } finally {
        setLoading(false);
      }
    };
    loadQuestions();
  }, [bankId, isGuest]);

  // 监听网络状态变化
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = (): void => {
      if (isOffline) {
        setJustReconnected(true);
        toast.success('网络已恢复，作答记录正在同步...');
        // 3 秒后隐藏提示
        setTimeout(() => setJustReconnected(false), 3000);
      }
      setIsOffline(false);
    };

    const handleOffline = (): void => {
      // 只有在有本地数据时才显示离线模式标识
      if (bankId) {
        void getQuestionsByBank(bankId).then((qs) => {
          if (qs.length > 0) {
            setIsOffline(true);
            toast.warning('网络已断开，切换到离线模式');
          }
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 初始化时检测网络状态
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [bankId, isOffline]);

  useEffect(() => {
    if (loading || showResult) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, startedAt, showResult]);

  useEffect(() => {
    if (!recordId || loading) return;
    const handleLeave = () => {
      saveAllProgress();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveAllProgress();
      }
    };
    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('pagehide', handleLeave);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', handleLeave);
      window.removeEventListener('pagehide', handleLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [recordId, loading, saveAllProgress]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      if (quickAutoJumpTimerRef.current) {
        window.clearTimeout(quickAutoJumpTimerRef.current);
      }
    };
  }, []);

  // 从 location.state 补充初始化 practiceMode（state 在 SSR 后才能拿到）
  useEffect(() => {
    const stateMode = (location.state as { mode?: PracticeMode } | null)?.mode ?? null;
    if (stateMode && stateMode !== practiceMode) {
      const validModes: PracticeMode[] = ['basic', 'recite', 'quick'];
      if (validModes.includes(stateMode)) {
        setPracticeModeState(stateMode);
        safeSetItem('practice_last_mode', stateMode);
        setAllAnswers((prev) => {
          const next = [...prev];
          if (!submitted[currentIndex]) {
            next[currentIndex] = [];
          }
          return next;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (index: number) => {
    if (practiceMode === 'recite') return;
    if (showAnswer) return;
    setAllAnswers((prev) => {
      const next = [...prev];
      const current = next[currentIndex] || [];
      if (currentQuestion.questionType === 'single' || currentQuestion.questionType === 'b1') {
        next[currentIndex] = [index];
      } else {
        next[currentIndex] = current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index].sort((a, b) => a - b);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (practiceMode === 'recite') return;
    if (selectedAnswers.length === 0) {
      toast.error('请选择答案');
      return;
    }
    const currentDuration = questionElapsed;
    setQuestionDurations((prev) => {
      const next = [...prev];
      if (next[currentIndex] === 0 || currentDuration > next[currentIndex]) {
        next[currentIndex] = currentDuration;
      }
      return next;
    });
    setSubmitted((prev) => {
      const next = [...prev];
      next[currentIndex] = true;
      return next;
    });
    if (!isGuest) {
      saveAllProgress();
      if (currentQuestion) {
        checkinApi
          .recordAnswer({ questionId: currentQuestion.id })
          .catch((err: unknown) => {
            logger.warn('打卡计数更新失败', err);
          });
      }
    }
    // 速读模式：答对自动跳下一题
    if (practiceMode === 'quick') {
      // correctFlags 在下次渲染才更新，这里现场算一次
      let isCorrectNow = false;
      if (currentQuestion) {
        if (currentQuestion.questionType === 'b1') {
          const userAns = selectedAnswers[0];
          const correctIdx = currentQuestion.options.findIndex(
            (o) => o.label === currentQuestion.subQuestion?.correctAnswer,
          );
          isCorrectNow = userAns === correctIdx;
        } else {
          const userSorted = [...selectedAnswers].sort();
          const correctSorted = [...currentQuestion.correctAnswers].sort();
          isCorrectNow =
            userSorted.length === correctSorted.length &&
            userSorted.every((v, i) => v === correctSorted[i]);
        }
      }
      if (isCorrectNow && currentIndex < flatQuestions.length - 1) {
        if (quickAutoJumpTimerRef.current) {
          window.clearTimeout(quickAutoJumpTimerRef.current);
        }
        quickAutoJumpTimerRef.current = window.setTimeout(() => {
          goToNext();
        }, 800);
      }
    }
  };

  const handleToggleFavorite = async (favorited: boolean) => {
    if (!currentQuestion) return;
    // 收藏管理完全由 FavoriteGroupMenu 组件内部处理，这里只同步本地状态
    setFavorites((prev) => ({ ...prev, [currentQuestion.id]: favorited }));
  };

  const isCurrentInWrongBook = currentQuestion
    ? (currentQuestion.wrongCount || 0) > 0 && !currentQuestion.mastered
    : false;

  const handleRemoveFromWrongBook = async () => {
    if (!currentQuestion) return;
    try {
      const res = await questionBankApi.removeFromWrongBook(currentQuestion.id);
      if (res.removed) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === currentQuestion.id
              ? { ...q, wrongCount: 0 }
              : q,
          ),
        );
        toast.success('已从错题本移除');
      }
    } catch (error) {
      logger.error('移出错题本失败', error);
      toast.error('操作失败');
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      const prevId = currentQuestion?.id;
      const prevDuration = questionElapsed;
      if (quickAutoJumpTimerRef.current) {
        window.clearTimeout(quickAutoJumpTimerRef.current);
        quickAutoJumpTimerRef.current = null;
      }
      setCurrentIndex(currentIndex - 1);
      scheduleSave();
      if (prevId) recordAndResetQuestionTimer(prevId, prevDuration);
    }
  };

  const goToNext = () => {
    if (currentIndex < flatQuestions.length - 1) {
      const prevId = currentQuestion?.id;
      const prevDuration = questionElapsed;
      setCurrentIndex(currentIndex + 1);
      scheduleSave();
      if (prevId) recordAndResetQuestionTimer(prevId, prevDuration);
    }
  };

  const goToQuestion = (idx: number) => {
    if (idx >= 0 && idx < flatQuestions.length) {
      const prevId = currentQuestion?.id;
      const prevDuration = questionElapsed;
      setCurrentIndex(idx);
      scheduleSave();
      if (prevId && idx !== currentIndex)
        recordAndResetQuestionTimer(prevId, prevDuration);
    }
  };

  const handleFinish = async () => {
    if (!bankId) return;

    try {
      setSubmittingResult(true);
      // 速记模式：直接展示结果，不创建/提交记录
      if (practiceMode === 'recite') {
        setSubmittingResult(false);
        setShowResult(true);
        return;
      }
      if (!isGuest) {
        const finishedAt = Date.now();
        const durationSeconds = Math.floor((finishedAt - startedAt) / 1000);
        const correct = correctCount;
        const submittedCount = submitted.filter(Boolean).length;
        const accuracyRate =
          submittedCount > 0 ? correct / submittedCount : 0;

        if (isOffline) {
          // 离线模式：保存到本地 IndexedDB，等待同步
          await saveAllProgress();
          // 构造答案 payload
          const payloads = buildGroupedSavePayload();
          const answers: PracticeAnswerItem[] = payloads.map((p) => ({
            questionId: p.questionId,
            userAnswers: p.userAnswers,
            isCorrect: p.isCorrect,
          }));
          await saveOfflineRecord({
            bankId,
            bankName,
            answers,
            durationSeconds,
            totalCount: questions.length,
            correctCount: correct,
            accuracyRate,
            startedAt: new Date(startedAt).toISOString(),
            finishedAt: new Date(finishedAt).toISOString(),
            synced: false,
          });
          toast.success('作答已保存到本地，联网后自动同步');
        } else {
          await saveAllProgress();
          await practiceRecordApi.finishSession({
            recordId,
            correctCount: correct,
            accuracyRate,
            durationSeconds,
            finishedAt: new Date(finishedAt).toISOString(),
          });
        }
      }

      setShowResult(true);
    } catch (error) {
      logger.error('提交结果失败', error);
      // 降级：提交失败时保存到本地 IndexedDB，联网后自动同步
      if (!isGuest && practiceMode !== 'recite' && bankId) {
        try {
          const finishedAt = Date.now();
          const durationSeconds = Math.floor((finishedAt - startedAt) / 1000);
          const correct = correctCount;
          const submittedCount = submitted.filter(Boolean).length;
          const accuracyRate = submittedCount > 0 ? correct / submittedCount : 0;
          const payloads = buildGroupedSavePayload();
          const answers: PracticeAnswerItem[] = payloads.map((p) => ({
            questionId: p.questionId,
            userAnswers: p.userAnswers,
            isCorrect: p.isCorrect,
          }));
          await saveOfflineRecord({
            bankId,
            bankName,
            answers,
            durationSeconds,
            totalCount: questions.length,
            correctCount: correct,
            accuracyRate,
            startedAt: new Date(startedAt).toISOString(),
            finishedAt: new Date(finishedAt).toISOString(),
            synced: false,
          });
          toast.success('提交失败，作答已保存到本地，联网后自动同步');
        } catch (fallbackError) {
          logger.error('降级保存也失败', fallbackError);
          toast.error('提交结果失败，且本地保存失败');
        }
      } else {
        toast.error('提交结果失败');
      }
    } finally {
      setSubmittingResult(false);
    }
  };

  const handleRestart = async () => {
    if (!bankId || questions.length === 0) return;
    try {
      setSubmittingResult(true);
      if (!isGuest && practiceMode !== 'recite') {
        const session = await practiceRecordApi.createSession({
          bankId,
          totalCount: questions.length,
          practiceMode,
        });
        setRecordId(session.recordId);
      } else {
        setRecordId(null);
      }
      const nextQuestions = orderMode === 'shuffle'
        ? shuffleArray([...questions])
        : questions;
      const nextFlat = buildFlatQuestions(nextQuestions);
      setQuestions(nextQuestions);
      setFlatQuestions(nextFlat);
      setAllAnswers(new Array(nextFlat.length).fill(null).map(() => []));
      setSubmitted(new Array(nextFlat.length).fill(false));
      setCurrentIndex(0);
       setStartedAt(Date.now());
       setElapsed(0);
       setQuestionStartTime(Date.now());
       setQuestionElapsed(0);
       setShowResult(false);
    } catch (error) {
      logger.error('重新开始失败', error);
      toast.error('重新开始失败');
    } finally {
      setSubmittingResult(false);
    }
  };

  const unansweredCount = submitted.filter(Boolean).length === 0
    ? flatQuestions.length
    : submitted.filter((s) => !s).length;
  const wrongCount = submitted.filter((s, idx) => s && !correctFlags[idx]).length;

  // 快捷键：选项选择 / 提交 / 翻题 / 收藏 / 笔记 / 帮助
  useHotkeys(
    {
      a: () => handleSelect(0),
      b: () => handleSelect(1),
      c: () => handleSelect(2),
      d: () => handleSelect(3),
      e: () => handleSelect(4),
      arrowleft: () => goToPrev(),
         arrowright: () => {
        if (showAnswer && currentIndex < flatQuestions.length - 1) {
          goToNext();
        }
      },
       enter: () => {
         if (showAnswer) {
           if (currentIndex === flatQuestions.length - 1) {
             void handleFinish();
           } else {
             goToNext();
           }
         } else if (selectedAnswers.length > 0) {
           handleSubmit();
         }
       },
      f: () => {
        if (!currentQuestion || isGuest) return;
        const nextState = !favorites[currentQuestion.id];
        setFavorites((prev) => ({ ...prev, [currentQuestion!.id]: nextState }));
        void (async () => {
          try {
            await questionBankApi.updateFavorite({
              questionId: currentQuestion!.id,
              isFavorited: nextState,
            });
            toast.success(nextState ? '已收藏' : '已取消收藏');
          } catch (error) {
            logger.error('收藏操作失败', error);
            setFavorites((prev) => ({ ...prev, [currentQuestion!.id]: !nextState }));
            toast.error('操作失败');
          }
        })();
      },
      n: () => {
        actionBarRef.current?.toggleNote();
      },
      '?': () => {
        setShortcutsOpen(true);
      },
    },
    {
      enabled: !loading && !showResult && !!currentQuestion,
    },
  );

  // Esc 关闭帮助弹窗（当弹窗打开时）
  useEffect(() => {
    if (!shortcutsOpen) return undefined;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setShortcutsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [shortcutsOpen]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // 单题计时器
  useEffect(() => {
    if (loading || showResult) return;
    const timer = setInterval(() => {
      setQuestionElapsed(Math.floor((Date.now() - questionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, questionStartTime, showResult]);

  // 题目首次加载完成时重置单题计时
  useEffect(() => {
    if (!loading && currentQuestion) {
      setQuestionStartTime(Date.now());
      setQuestionElapsed(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // 记录上一题用时并重置计时器
  const recordAndResetQuestionTimer = useCallback((prevQuestionId: string, prevDuration: number) => {
    if (!isGuest && recordId && prevQuestionId && prevDuration > 0) {
      questionApi
        .recordAnswerTime(prevQuestionId, {
          recordId,
          questionId: prevQuestionId,
          durationSeconds: prevDuration,
        })
        .catch((err: unknown) => {
          logger.warn('记录单题用时失败', err);
        });
    }
    setQuestionStartTime(Date.now());
    setQuestionElapsed(0);
  }, [isGuest, recordId]);

  const [toolbarCollapsed, setToolbarCollapsed] = useState<boolean>(() => {
    const saved = safeGetItem('practice_toolbar_collapsed_v3');
    if (saved === null) return true;
    return saved === 'true';
  });

  const toggleToolbar = useCallback(() => {
    setToolbarCollapsed((prev) => {
      const next = !prev;
      safeSetItem('practice_toolbar_collapsed_v3', String(next));
      return next;
    });
  }, []);

  const progressPercent =
    flatQuestions.length > 0 ? ((currentIndex + 1) / flatQuestions.length) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showResult) {
    const submittedCount = submitted.filter(Boolean).length;
    return (
      <ResultPanel
        correctCount={correctCount}
        wrongCount={wrongCount}
        unansweredCount={unansweredCount}
         totalCount={flatQuestions.length}
        submittedCount={submittedCount}
        durationSeconds={elapsed}
        onBack={() => navigate('/banks')}
        onRetry={handleRestart}
        submitting={submittingResult}
        isGuest={isGuest}
      />
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-foreground">题集中暂无题目</p>
        <p className="mt-2 text-sm text-muted-foreground">请先导入或添加题目</p>
        <Button
          variant="default"
          className="mt-6"
          onClick={() => navigate('/banks')}
        >
          返回题集
        </Button>
      </div>
    );
  }

  const isCorrect = showCorrectness
    ? (() => {
        const userSorted = [...selectedAnswers].sort();
        const correctSorted = [...currentQuestion.correctAnswers].sort();
        return (
          userSorted.length === correctSorted.length &&
          userSorted.every((v, i) => v === correctSorted[i])
        );
      })()
    : false;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-8">
      {/* 顶部导航栏 */}
      <div className="sticky top-2 z-20 -mx-1 overflow-hidden rounded-2xl border border-border bg-white px-2 py-2 shadow-sm sm:-mx-4 sm:top-4 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/banks')}
            className="h-9 w-9 rounded-xl text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
           <div className="text-center">
              <div className="flex items-center justify-center gap-1.5">
               <p className="text-sm font-semibold text-foreground tabular-nums sm:text-base">
                   第 {currentIndex + 1} <span className="text-muted-foreground font-normal wallpaper-text-muted">/</span> {flatQuestions.length} 题
                 </p>
                {isOffline && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                    <CloudOff className="h-3 w-3" />
                    离线模式
                  </span>
                )}
                {justReconnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                    <Cloud className="h-3 w-3" />
                    同步中
                  </span>
                )}
              </div>
              {!toolbarCollapsed && (
                <div className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted-foreground wallpaper-text-muted">
                 <Clock className="h-3 w-3" />
                 <span className="tabular-nums">{formatTime(elapsed)}</span>
                 {restoring && (
                   <span className="ml-1.5 text-primary">· 恢复进度中</span>
                 )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 单题计时器 */}
              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary/10 to-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground ring-1 ring-primary/20 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs">
                <Clock className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
                <span className="tabular-nums font-mono tracking-wide">{formatTime(questionElapsed)}</span>
              </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleToolbar}
              className="h-9 gap-1 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={toolbarCollapsed ? '展开工具栏' : '收起工具栏'}
            >
              {toolbarCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              <span className="text-xs font-medium">{toolbarCollapsed ? '展开' : '收起'}</span>
            </Button>
            {!toolbarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShortcutsOpen(true)}
                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label="快捷键帮助"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            )}
             {!toolbarCollapsed && (
               <Button
                 variant="outline"
                 size="sm"
                 onClick={handleManualSave}
                 disabled={saving || !recordId}
                 className="h-9 gap-1.5 rounded-xl border border-border/60 transition-all duration-200 hover:border-primary/40 hover:bg-accent/50"
               >
                 {saving ? (
                   <Loader2 className="h-3.5 w-3.5 animate-spin" />
                 ) : saved ? (
                   <Check className="h-3.5 w-3.5 text-success" />
                 ) : (
                   <Save className="h-3.5 w-3.5" />
                 )}
                  <span className="hidden sm:inline">{saving ? '保存中' : saved ? '已保存' : '保存'}</span>
               </Button>
             )}
            {!toolbarCollapsed && (
              <Button
                size="sm"
                onClick={() => setClearDialogOpen(true)}
                disabled={currentIndex >= flatQuestions.length || !submitted.slice(currentIndex).some(Boolean)}
                className="h-9 gap-1.5 rounded-xl bg-destructive text-destructive-foreground shadow-sm transition-all duration-200 hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="清除后续答题记录"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">清后续</span>
              </Button>
            )}
            </div>
         </div>
      </div>

       {/* 排序模式 + 练习模式 + 统计 + 进度条 + 导航（可折叠） */}
       {!toolbarCollapsed && (
        <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
       <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
         <div className="flex flex-wrap items-center gap-2">
           <div className="inline-flex items-center gap-1 rounded-full bg-muted/70 p-1 shadow-sm">
             <button
               type="button"
               className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                 orderMode === 'original'
                   ? 'bg-card text-foreground shadow-sm'
                   : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
               }`}
               onClick={() => setOrderMode('original')}
               disabled={submitted.some(Boolean)}
             >
               原顺序
             </button>
             <button
               type="button"
               className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                 orderMode === 'shuffle'
                   ? 'bg-card text-foreground shadow-sm'
                   : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
               }`}
               onClick={() => {
                 const shuffled = shuffleArray([...questions]);
                 const flatShuffled = buildFlatQuestions(shuffled);
                 setQuestions(shuffled);
                 setFlatQuestions(flatShuffled);
                 setAllAnswers(new Array(flatShuffled.length).fill(null).map(() => []));
                 setSubmitted(new Array(flatShuffled.length).fill(false));
                 setCurrentIndex(0);
                 setOrderMode('shuffle');
               }}
               disabled={submitted.some(Boolean)}
             >
               乱序
             </button>
           </div>
           <div className="inline-flex items-center gap-1 rounded-full bg-muted/70 p-1 shadow-sm">
               {(['basic', 'recite', 'quick'] as PracticeMode[]).map((m) => (
                 <button
                   key={m}
                   type="button"
                   className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                     practiceMode === m
                       ? 'bg-card text-foreground shadow-sm'
                       : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                   }`}
                   onClick={() => setPracticeMode(m)}
                 >
                   {m === 'basic' ? '基础' : m === 'recite' ? '速记' : '速读'}
                 </button>
               ))}
             </div>
           </div>
             <p className="flex items-center gap-2 text-muted-foreground tabular-nums">
               共 {flatQuestions.length} 题 · {typeSummary} · 已做 <span className="font-medium text-foreground">{submitted.filter(Boolean).length}</span> 题
             </p>
         </div>

      {/* 渐变进度条 */}
      <div className="overflow-hidden rounded-full bg-muted/70 shadow-inner">
        <div
          className="h-2.5 rounded-full bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] shadow-[0_0_8px_hsl(265_85%_65%/0.4)] transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

       <QuestionNavigator
         total={flatQuestions.length}
         currentIndex={currentIndex}
         submitted={submitted}
         correctFlags={correctFlags}
         questionTypes={flatQuestions.map((q) => q.questionType)}
         onJump={goToQuestion}
         hasRecords={submitted.some(Boolean)}
         onClearRecords={() => setClearDialogOpen(true)}
       />
       </div>
       )}

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              清除后续答题记录
            </AlertDialogTitle>
            <AlertDialogDescription>
              确定要清除当前题及之后所有题的答题记录吗？当前题之前的作答记录将保留。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleClearRecords();
              }}
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  清除中
                </>
              ) : (
                '确认清除后续'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 语音读题工具条 */}
      {voiceSupported && (
        <div className="flex justify-end">
          <VoiceReader
            isSpeaking={isSpeaking}
            isPaused={isPaused}
            rate={voiceRate}
            scope={voiceScope}
            isSupported={voiceSupported}
            onPlayPause={handleVoicePlayPause}
            onStop={voiceStop}
            onRateChange={setVoiceRate}
            onScopeChange={setVoiceScope}
          />
        </div>
      )}

      <PracticeQuestionView
        question={currentQuestion}
        selectedAnswers={selectedAnswers}
        isSubmitted={isSubmitted}
        showAnswer={showAnswer}
        showCorrectness={showCorrectness}
        isCorrect={isCorrect}
        onSelectAnswer={handleSelect}
        onToggleFavorite={handleToggleFavorite}
        onRemoveFromWrongBook={handleRemoveFromWrongBook}
        isFavorited={!!favorites[currentQuestion.id]}
        isGuest={isGuest}
        isWrongBook={isCurrentInWrongBook}
        getTypeAbbr={getTypeAbbr}
        onPrev={goToPrev}
        onNext={goToNext}
        onSubmit={handleSubmit}
        onFinish={handleFinish}
        isFirst={currentIndex === 0}
        isLast={currentIndex === flatQuestions.length - 1}
        submittingResult={submittingResult}
      />

      {/* 题目操作栏（笔记/难度/反馈） */}
      <div className="border-t border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
        <QuestionActionBar
          ref={actionBarRef}
          questionId={currentQuestion.id}
          isGuest={isGuest}
        />
      </div>

      {showAnswer && (
        <QuestionComments questionId={currentQuestion.id} />
      )}

      {/* 快捷键帮助弹窗 */}
      <ShortcutsHelp
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  );
};

const ResultPanel = ({
  correctCount,
  wrongCount,
  unansweredCount,
  totalCount,
  submittedCount,
  durationSeconds,
  onBack,
  onRetry,
  submitting,
  isGuest,
}: {
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalCount: number;
  submittedCount: number;
  durationSeconds: number;
  onBack: () => void;
  onRetry: () => void;
  submitting: boolean;
  isGuest: boolean;
}) => {
  const accuracy = submittedCount > 0 ? (correctCount / submittedCount) * 100 : 0;
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}分${sec}秒`;
  };

  const getAccuracyColor = () => {
    if (accuracy >= 80) return 'text-success';
    if (accuracy >= 60) return 'text-primary';
    return 'text-destructive';
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <Card className="fade-in-up overflow-hidden rounded-xl border border-border/60 text-center shadow-md">
        <CardHeader className="pb-3 pt-10">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-accent to-pink-100/60 shadow-lg ring-4 ring-white">
            <Trophy className="h-12 w-12 text-primary" />
          </div>
          <h2 className="bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-3xl font-bold text-transparent">
            练习完成 🎉
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isGuest ? '游客模式不保存作答记录' : '本次作答已记录'}
          </p>
        </CardHeader>
        <CardContent className="space-y-7 px-7 pb-7">
          {/* 正确率大数字 */}
          <div>
            <p
              className={`text-7xl font-bold tabular-nums ${getAccuracyColor()}`}
            >
              {accuracy.toFixed(0)}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">正确率（按已作答题数计算）</p>
          </div>

          {/* 三栏统计 */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="group rounded-xl bg-success/10 p-4 ring-1 ring-success/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-2xl font-bold text-success tabular-nums">
                {correctCount}
              </p>
              <p className="mt-1 text-xs font-medium text-success/75">答对</p>
            </div>
            <div className="group rounded-xl bg-destructive/10 p-4 ring-1 ring-destructive/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-2xl font-bold text-destructive tabular-nums">
                {wrongCount}
              </p>
              <p className="mt-1 text-xs font-medium text-destructive/75">答错</p>
            </div>
            <div className="group rounded-xl bg-muted/70 p-4 ring-1 ring-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-2xl font-bold text-muted-foreground tabular-nums">
                {unansweredCount}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground/75">未答</p>
            </div>
          </div>

          {/* 明细 */}
          <div className="rounded-xl bg-gradient-to-br from-accent/40 to-primary/5 p-5 text-left text-sm ring-1 ring-primary/10">
            <div className="flex items-center justify-between">
              <span className="font-medium text-accent-foreground/90">总题数</span>
              <span className="font-bold tabular-nums text-foreground">{totalCount} 题</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-medium text-accent-foreground/90">用时</span>
              <span className="font-bold tabular-nums text-foreground">{formatTime(durationSeconds)}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3 border-t border-border/60 bg-gradient-to-t from-muted/40 to-transparent px-7 py-5">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex-1 h-11 rounded-xl border border-border/60 transition-all duration-200 hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm"
          >
            返回题集
          </Button>
          <Button
            variant="default"
            onClick={onRetry}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-sm font-semibold text-white shadow-[0_4px_16px_hsl(265_85%_65%/0.35)] transition-all duration-200 hover:shadow-[0_6px_24px_hsl(265_85%_65%/0.45)] hover:brightness-105"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                重新开始
              </>
            ) : (
              '再练一次'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PracticePage;
