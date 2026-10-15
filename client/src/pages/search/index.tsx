import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from '@client/src/utils/router';
import { Search, X, Loader2, Play, Hash } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { TagChip } from '@client/src/components/TagChip';

import { questionTagApi, questionBankApi } from '@client/src/api';
import type { GlobalSearchQuestionItem } from '@shared/api.interface';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlKeyword = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(urlKeyword);
  const [results, setResults] = useState<GlobalSearchQuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const hasSearched = useRef(false);

  const debouncedSearch = useCallback(
    debounce((keyword: string) => {
      if (keyword.trim()) {
        setSearchParams({ q: keyword.trim() });
      } else {
        setSearchParams({});
      }
    }, 300),
    [setSearchParams],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    debouncedSearch(val);
  };

  const handleClear = () => {
    setInputValue('');
    setResults([]);
    setTotal(0);
    setSearchParams({});
  };

  const doSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    try {
      setLoading(true);
      const res = await questionTagApi.globalSearch(keyword.trim(), 50);
      setResults(res.items);
      setTotal(res.total);
    } catch (error) {
      logger.error('搜索失败', error);
      toast.error('搜索失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (urlKeyword) {
      hasSearched.current = true;
      doSearch(urlKeyword);
    } else {
      setResults([]);
      setTotal(0);
    }
  }, [urlKeyword, doSearch]);

  const handlePracticeOne = async (questionId: string) => {
    try {
      const res = await questionBankApi.generateRandomBankByIds({
        questionIds: [questionId],
        name: '搜索练习',
      });
      if (res?.bankId) {
        navigate(`/practice/${res.bankId}`);
      }
    } catch (error) {
      logger.error('生成单题练习失败', error);
      toast.error('操作失败');
    }
  };

  const showEmpty = !loading && hasSearched.current && urlKeyword && results.length === 0;
  const showHint = !urlKeyword && !loading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">全局搜索</h1>
<p className="mt-1 text-sm text-muted-foreground wallpaper-text-muted">
            跨所有题集搜索题目，支持题干内容和标签筛选
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={handleInputChange}
          placeholder="输入关键词搜索题目..."
          className="pl-10 pr-10 text-sm"
          autoFocus
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="清空搜索"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {urlKeyword && !loading && (
        <p className="text-xs text-muted-foreground">
          共找到 <span className="font-medium text-foreground">{total}</span> 道匹配的题目
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {showEmpty && (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">
            未找到匹配的题目
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            试试其他关键词，或检查拼写是否正确
          </p>
        </div>
      )}

      {showHint && (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">
            输入关键词开始搜索
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
             支持按题干内容搜索，查找所有题集中的题目
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map((item) => (
            <SearchResultCard
              key={item.id}
              item={item}
              keyword={urlKeyword}
              onPractice={() => handlePracticeOne(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function SearchResultCard({
  item,
  keyword,
  onPractice,
}: {
  item: GlobalSearchQuestionItem;
  keyword: string;
  onPractice: () => void;
}) {
  const highlight = (text: string, kw: string) => {
    if (!kw.trim()) return text;
    const idx = text.toLowerCase().indexOf(kw.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-200/60 px-0.5 text-foreground">
          {text.slice(idx, idx + kw.length)}
        </mark>
        {text.slice(idx + kw.length)}
      </>
    );
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
               <Badge variant="outline" className="h-5 font-normal">
                 {item.questionType === 'single'
                   ? 'A1型题'
                   : item.questionType === 'multiple'
                     ? 'X型题'
                     : 'B1型题'}
               </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />
                {item.bankName}
              </span>
              {item.isFavorited && (
                <Badge variant="secondary" className="h-5 bg-amber-500/10 text-amber-700">
                  已收藏
                </Badge>
              )}
              {item.wrongCount > 0 && (
                <Badge variant="secondary" className="h-5 bg-red-500/10 text-red-700">
                  错 {item.wrongCount} 次
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground line-clamp-2">
              {highlight(item.content, keyword)}
            </p>
            {item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {item.tags.map((t) => (
                  <TagChip key={t.id} tag={t} />
                ))}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onPractice}
            className="shrink-0 gap-1"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            练习
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default SearchPage;
