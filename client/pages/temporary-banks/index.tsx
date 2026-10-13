import { useState, useEffect } from 'react';
import { useNavigate } from '@client/src/utils/router';
import { Clock3, Loader2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { questionBankApi } from '@client/src/api';
import type { QuestionBankItem } from '@shared/api.interface';
import BankCardList from '../banks/BankCardList';
import { SmartRecommendCard } from '@client/src/components/smart/SmartRecommendCard';

const TemporaryBanksPage = () => {
  const [banks, setBanks] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadBanks = async () => {
    try {
      setLoading(true);
      const res = await questionBankApi.getBanks();
      setBanks(res.items.filter((b) => b.bankType === 'temporary' || b.isTemporary));
    } catch (error) {
       logger.error('加载临时题集失败', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanks();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await questionBankApi.deleteBank(id);
      setBanks((prev) => prev.filter((b) => b.id !== id));
      toast.success('删除成功');
    } catch (error) {
       logger.error('删除题集失败', error);
      toast.error('删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">临时题集</h1>
 <p className="mt-1 text-sm text-muted-foreground wallpaper-text-muted">
              随机抽题生成的临时题集，共 {banks.length} 个
          </p>
        </div>
      </div>

      <SmartRecommendCard />

      <BankCardList
        banks={banks}
        loading={loading}
        emptyTitle="暂无临时题集"
        emptyDescription="在「我的题集」中使用「随机抽题」功能生成"
        emptyIcon={Clock3}
        onDelete={handleDelete}
        onPractice={(id) => navigate(`/practice/${id}`)}
        onRefresh={loadBanks}
      />
    </div>
  );
};

export default TemporaryBanksPage;
