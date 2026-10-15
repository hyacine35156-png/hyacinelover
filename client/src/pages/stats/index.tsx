import { useState, useEffect, useCallback } from 'react';
import { Loader2, BarChart3, BookOpen, Target, Sparkles, ScrollText, RefreshCw } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import { statsApi } from '@client/src/api';
import type {
  LearningDashboardResponse,
  KnowledgeMasteryResponse,
  LearningGoalsItem,
  CheckinCalendarResponse,
} from '@shared/api.interface';
import DashboardTab from './DashboardTab';
import KnowledgeTab from './KnowledgeTab';
import GoalsTab from './GoalsTab';
import RecordsTab from './RecordsTab';

 const StatsPage = () => {
   const [dashboard, setDashboard] = useState<LearningDashboardResponse | null>(null);
   const [knowledge, setKnowledge] = useState<KnowledgeMasteryResponse | null>(null);
   const [goals, setGoals] = useState<LearningGoalsItem | null>(null);
   const [checkin, setCheckin] = useState<CheckinCalendarResponse | null>(null);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [activeTab, setActiveTab] = useState('dashboard');

   const loadAllData = useCallback(async (showLoading = true) => {
     try {
       if (showLoading) setLoading(true);
       const [dashboardRes, knowledgeRes, goalsRes, checkinRes] = await Promise.all([
         statsApi.getDashboard(),
         statsApi.getKnowledgeMastery(),
         statsApi.getLearningGoals(),
         statsApi.getCheckinCalendar(30),
       ]);
       setDashboard(dashboardRes);
       setKnowledge(knowledgeRes);
       setGoals(goalsRes);
       setCheckin(checkinRes);
     } catch (error) {
       logger.error('加载统计数据失败', error);
       toast.error('加载统计数据失败');
     } finally {
       setLoading(false);
       setRefreshing(false);
     }
   }, []);

   const handleRefresh = useCallback(async () => {
     setRefreshing(true);
     await loadAllData(false);
     toast.success('数据已更新');
   }, [loadAllData]);

   useEffect(() => {
     loadAllData();
   }, [loadAllData]);

   useEffect(() => {
     const handleVisibility = () => {
       if (document.visibilityState === 'visible' && !loading) {
         loadAllData(false);
       }
     };
     document.addEventListener('visibilitychange', handleVisibility);
     return () => document.removeEventListener('visibilitychange', handleVisibility);
   }, [loadAllData, loading]);

  const handleGoalsUpdate = (updatedGoals: LearningGoalsItem) => {
    setGoals(updatedGoals);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in-up">
       {/* 页面标题 */}
       <div className="flex items-start justify-between">
         <div>
           <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
             <Sparkles className="h-3.5 w-3.5" />
             学习数据
           </div>
           <h1 className="text-2xl font-bold tracking-tight text-foreground">数据统计</h1>
 <p className="mt-1 text-sm text-muted-foreground wallpaper-text-muted">
            全面掌握你的学习进度，让努力看得见
          </p>
         </div>
         <Button
           variant="outline"
           size="sm"
           onClick={handleRefresh}
           disabled={refreshing || loading}
           className="gap-1.5"
         >
           <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
           刷新数据
         </Button>
       </div>

      {/* Tab 切换 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 gap-1 h-auto sm:inline-flex sm:w-auto sm:gap-0 sm:h-9">
          <TabsTrigger value="dashboard" className="w-full justify-center sm:flex-initial">
            <BarChart3 className="h-4 w-4" />
            学习仪表盘
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="w-full justify-center sm:flex-initial">
            <BookOpen className="h-4 w-4" />
            知识点掌握度
          </TabsTrigger>
          <TabsTrigger value="goals" className="w-full justify-center sm:flex-initial">
            <Target className="h-4 w-4" />
            学习目标
          </TabsTrigger>
          <TabsTrigger value="records" className="w-full justify-center sm:flex-initial">
            <ScrollText className="h-4 w-4" />
            作答记录
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          {dashboard && checkin && (
            <DashboardTab dashboard={dashboard} checkin={checkin} />
          )}
        </TabsContent>

        <TabsContent value="knowledge" className="mt-4">
          {knowledge && <KnowledgeTab data={knowledge} />}
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          {goals && <GoalsTab goals={goals} onUpdate={handleGoalsUpdate} />}
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <RecordsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StatsPage;
