// 前后端共享的类型定义

// ==================== 题库相关 ====================

export interface QuestionOption {
  label: string;
  text: string;
}

export type QuestionType = 'single' | 'multiple' | 'b1';

export interface SubQuestion {
  content: string;
  correctAnswer: string;
  analysis: string;
}

export type BankType = 'normal' | 'temporary' | 'favorite' | 'wrongbook' | 'important_wrongbook';

export interface QuestionBankItem {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  isTemporary: boolean;
  bankType: BankType;
  isPublic: boolean;
  ownerUsername?: string;
  subjectId?: string | null;
  subjectName?: string | null;
  avgRating?: number;
  ratingCount?: number;
  createdAt: string;
}

export interface QuestionBankListResponse {
  items: QuestionBankItem[];
}

export interface CreateQuestionBankRequest {
  name: string;
  description?: string;
  subjectId?: string | null;
  isPublic?: boolean;
}

export interface CreateQuestionBankResponse {
  id: string;
  name: string;
  questionCount: number;
  createdAt: string;
  warnings?: string[];
}

export interface DeleteQuestionBankResponse {
  success: boolean;
}

export interface UpdateQuestionBankRequest {
  name?: string;
  description?: string;
  subjectId?: string | null;
  isPublic?: boolean;
}

export interface CopyQuestionBankRequest {
  targetName: string;
  targetSubjectId?: string | null;
}

export interface CopyQuestionBankResponse {
  id: string;
  name: string;
  questionCount: number;
}

export interface GenerateRandomBankRequest {
  sourceBankIds: string[];
  questionCount: number;
  name?: string;
}

export interface GenerateRandomBankResponse {
  bankId: string;
  name: string;
  questionCount: number;
  createdAt: string;
}

export interface GenerateRandomBankByIdsRequest {
  questionIds: string[];
  name?: string;
}

export interface UpdateFavoriteRequest {
  questionId: string;
  isFavorited: boolean;
}

export interface UpdateFavoriteResponse {
  success: boolean;
  isFavorited: boolean;
}

export interface FavoriteItem {
  questionId: string;
  isFavorited: boolean;
}

export interface FavoriteListResponse {
  items: FavoriteItem[];
}

export interface QuestionWithFavorite extends QuestionItem {
  isFavorited: boolean;
  wrongCount: number;
  mastered: boolean;
  wrongReason?: WrongReason | null;
  note?: string | null;
  difficulty?: DifficultyLevel | null;
}

export interface QuestionWithFavoriteListResponse {
  items: QuestionWithFavorite[];
}

export interface UpdateQuestionRequest {
  content?: string;
  questionType?: QuestionType;
  options?: QuestionOption[];
  correctAnswers?: number[];
  analysis?: string;
  subQuestions?: SubQuestion[];
  knowledgePoints?: string;
  unitName?: string | null;
}

export interface DeleteQuestionResponse {
  success: boolean;
}

// ==================== 题目相关 ====================

export interface QuestionItem {
  id: string;
  content: string;
  questionType: QuestionType;
  options: QuestionOption[];
  correctAnswers: number[];
  analysis: string;
  subQuestions: SubQuestion[];
  knowledgePoints: string;
  unitName?: string | null;
  sortOrder: number;
}

export interface QuestionListResponse {
  items: QuestionItem[];
}

export interface CreateQuestionRequest {
  content: string;
  questionType: QuestionType;
  options: QuestionOption[];
  correctAnswers: number[];
  analysis?: string;
  subQuestions?: SubQuestion[];
  knowledgePoints?: string;
  unitName?: string | null;
}

export interface CreateQuestionResponse {
  id: string;
  content: string;
}

// ==================== 题目评论相关 ====================

export interface QuestionCommentItem {
  id: string;
  questionId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  canDelete?: boolean;
}

export interface QuestionCommentListResponse {
  items: QuestionCommentItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface CreateQuestionCommentRequest {
  content: string;
}

export interface CreateQuestionCommentResponse {
  id: string;
}

// ==================== 文件导入相关 ====================

export interface ParsedQuestionItem {
  content: string;
  questionType: QuestionType;
  options: QuestionOption[];
  correctAnswers: number[];
  analysis: string;
  subQuestions: SubQuestion[];
  confidence?: number;
  warning?: string;
}

export interface WordPreviewResponse {
  totalCount: number;
  singleCount: number;
  multipleCount: number;
  b1Count: number;
  lowConfidenceCount: number;
  questions: ParsedQuestionItem[];
  failures: { index: number; reason: string }[];
}

export interface ImportQuestionBankResponse {
  bankId: string;
  successCount: number;
  failCount: number;
  failures: { row: number; reason: string }[];
  singleCount?: number;
  multipleCount?: number;
  b1Count?: number;
  sourceFormat?: 'excel' | 'csv' | 'json' | 'word';
  warnings?: string[];
}

// ==================== 科目相关 ====================

export interface SubjectItem {
  id: string;
  name: string;
  color: string;
  icon?: string;
  bankCount?: number;
  createdAt: string;
}

export interface SubjectListResponse {
  items: SubjectItem[];
}

export interface CreateSubjectRequest {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateSubjectRequest {
  name?: string;
  color?: string;
  icon?: string;
}

export interface BatchMoveBanksRequest {
  bankIds: string[];
  targetSubjectId: string | null;
}

// ==================== 标签相关 ====================

export type LabelType = 'public' | 'private';

export interface QuestionTagItem {
  id: string;
  name: string;
  color: string;
  labelType: LabelType;
  questionCount?: number;
  createdAt: string;
}

export interface QuestionTagListResponse {
  items: QuestionTagItem[];
}

export interface CreateQuestionTagRequest {
  name: string;
  color?: string;
  labelType?: LabelType;
}

export interface UpdateQuestionTagRequest {
  name?: string;
  color?: string;
  labelType?: LabelType;
}

export interface SetQuestionTagsRequest {
  tagIds: string[];
}

export interface QuestionTagWithQuestionsResponse {
  tag: QuestionTagItem;
  items: QuestionWithFavorite[];
}

export interface GenerateRandomBankByTagsRequest {
  tagIds: string[];
  questionCount: number;
  name?: string;
}

// ==================== 全局搜索相关 ====================

export interface GlobalSearchQuestionItem {
  id: string;
  content: string;
  questionType: QuestionType;
  bankId: string;
  bankName: string;
  bankType: BankType;
  isFavorited: boolean;
  wrongCount: number;
  tags: { id: string; name: string; color: string; labelType: LabelType }[];
}

export interface GlobalSearchResponse {
  items: GlobalSearchQuestionItem[];
  total: number;
}

// ==================== 练习记录相关 ====================

export interface PracticeAnswerItem {
  questionId: string;
  userAnswers: number[];
  isCorrect: boolean;
}

export type PracticeMode = 'basic' | 'recite' | 'quick';

export interface PracticeRecordItem {
  id: string;
  bankId: string;
  bankName: string;
  totalCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracyRate: number;
  durationSeconds: number;
  finishedAt: string;
  practiceMode: PracticeMode;
}

export interface PracticeRecordListResponse {
  items: PracticeRecordItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePracticeRecordRequest {
  bankId: string;
  totalCount: number;
  correctCount: number;
  accuracyRate: number;
  durationSeconds: number;
  startedAt: string;
  finishedAt: string;
  answers: PracticeAnswerItem[];
}

export interface CreatePracticeRecordResponse {
  id: string;
  accuracyRate: number;
  correctCount: number;
  totalCount: number;
}

// ==================== 练习进度相关 ====================

export type PracticeStatus = 'in_progress' | 'finished';

export interface PracticeAnswerProgressItem {
  questionId: string;
  questionIndex: number;
  userAnswers: number[];
  isCorrect: boolean;
}

export interface PracticeSessionProgressResponse {
  recordId: string;
  bankId: string;
  status: PracticeStatus;
  currentIndex: number;
  totalCount: number;
  correctCount: number;
  startedAt: string;
  durationSeconds: number;
  orderMode: PracticeOrderMode;
  practiceMode: PracticeMode;
  questionIds: string[];
  answers: PracticeAnswerProgressItem[];
}

export type PracticeOrderMode = 'original' | 'shuffle';

export interface CreatePracticeSessionRequest {
  bankId: string;
  totalCount: number;
  orderMode?: PracticeOrderMode;
  practiceMode?: PracticeMode;
}

export interface SaveAnswerProgressRequest {
  recordId: string;
  questionId: string;
  questionIndex: number;
  userAnswers: number[];
  isCorrect: boolean;
  currentIndex: number;
}

export interface SaveBatchProgressRequest {
  recordId: string;
  currentIndex: number;
  answers: PracticeAnswerProgressItem[];
  durationSeconds?: number;
}

export interface ClearSubsequentAnswersRequest {
  recordId: string;
  questionIds: string[];
  currentIndex: number;
}

export interface ClearSubsequentAnswersResponse {
  success: boolean;
  deletedCount: number;
}

export interface FinishPracticeSessionRequest {
  recordId: string;
  correctCount: number;
  accuracyRate: number;
  durationSeconds: number;
  finishedAt: string;
}

export interface PracticeStatisticsResponse {
  totalQuestions: number;
  totalAccuracyRate: number;
  practicedBanks: number;
  bankStats: {
    bankId: string;
    bankName: string;
    accuracyRate: number;
    totalCount: number;
  }[];
}

export interface PracticeRecordDetailAnswer {
  questionId: string;
  questionContent: string;
  questionType: QuestionType;
  userAnswers: number[];
  correctAnswers: number[];
  isCorrect: boolean;
  options: QuestionOption[];
  subQuestions: SubQuestion[];
}

export interface PracticeRecordDetailResponse {
  id: string;
  bankName: string;
  totalCount: number;
  correctCount: number;
  accuracyRate: number;
  finishedAt: string;
  practiceMode: PracticeMode;
  answers: PracticeRecordDetailAnswer[];
}

// ==================== 应用用户认证相关 ====================

export interface AppUserItem {
  id: string;
  username: string;
  uid: string | null;
  role?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: AppUserItem;
  token: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
  browser?: string;
  os?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
}

export interface UserDeviceItem {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  browser?: string | null;
  os?: string | null;
  ipAddress?: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface DeviceListResponse {
  items: UserDeviceItem[];
}

export interface LogoutDeviceResponse {
  success: boolean;
  removedCount: number;
}

// ==================== 打卡相关 ====================

export interface CheckinSettingItem {
  isEnabled: boolean;
  dailyTarget: number;
}

export interface CheckinStatusResponse {
  isEnabled: boolean;
  dailyTarget: number;
  todayAnswered: number;
  todayCompleted: boolean;
  streakDays: number;
  totalCheckinDays: number;
}

export interface UpdateCheckinSettingRequest {
  isEnabled?: boolean;
  dailyTarget?: number;
}

export interface CheckinHistoryItem {
  date: string;
  answered: number;
  completed: boolean;
}

export interface CheckinHistoryResponse {
  items: CheckinHistoryItem[];
  streakDays: number;
  totalCheckinDays: number;
}

export interface RecordAnswerRequest {
  questionId: string;
}

// ==================== 阶段一：题目笔记/难度/反馈 ====================

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type FeedbackType =
  | 'wrong_answer'
  | 'unclear_content'
  | 'wrong_option'
  | 'wrong_analysis'
  | 'other';

export interface QuestionNoteResponse {
  questionId: string;
  note: string;
}

export interface SaveQuestionNoteRequest {
  note: string;
}

export interface QuestionDifficultyResponse {
  questionId: string;
  difficulty: DifficultyLevel;
}

export interface SetQuestionDifficultyRequest {
  difficulty: DifficultyLevel;
}

export interface SubmitFeedbackRequest {
  feedbackType: FeedbackType;
  description?: string;
}

export interface SubmitFeedbackResponse {
  success: boolean;
  id: string;
}

export interface RecordAnswerTimeRequest {
  recordId: string;
  questionId: string;
  durationSeconds: number;
}

export interface RecordAnswerTimeResponse {
  success: boolean;
}

// ==================== 阶段一：错题本 ====================

export type WrongReason =
  | 'concept_unclear'
  | 'careless'
  | 'dont_know'
  | 'no_time'
  | 'dispute'
  | 'other';

export interface SetWrongReasonRequest {
  questionId: string;
  reason: WrongReason;
}

export interface SetWrongReasonResponse {
  success: boolean;
  questionId: string;
  reason: WrongReason;
}

export interface WrongBookStatsResponse {
  totalWrong: number;
  byReason: { reason: WrongReason; count: number; rate: number }[];
  byType: { type: QuestionType; count: number; rate: number }[];
  byDifficulty: { difficulty: DifficultyLevel; count: number; rate: number }[];
  byKnowledge: { tagId: string; tagName: string; count: number; rate: number }[];
  byDate: { date: string; count: number }[];
}

export type ExportFormat = 'pdf' | 'word';
export type AnswerMode = 'show' | 'hide';

export interface WrongBookExportRequest {
  format: ExportFormat;
  scope?: 'all' | 'filtered' | 'date_range';
  reasonFilter?: WrongReason[];
  startDate?: string;
  endDate?: string;
  answerMode?: AnswerMode;
}

export interface FavoriteExportRequest {
  format: ExportFormat;
  answerMode?: AnswerMode;
}

// ==================== 阶段一：学习统计 ====================

export interface LearningDashboardResponse {
  today: {
    answeredCount: number;
    correctCount: number;
    accuracyRate: number;
    studySeconds: number;
  };
  week: {
    answeredCount: number;
    correctCount: number;
    accuracyRate: number;
    studySeconds: number;
    dailyAvg: number;
  };
  month: {
    answeredCount: number;
    correctCount: number;
    accuracyRate: number;
    studySeconds: number;
    dailyAvg: number;
  };
  total: {
    answeredCount: number;
    correctCount: number;
    accuracyRate: number;
    studySeconds: number;
    studyDays: number;
  };
  trend7: { date: string; answeredCount: number; accuracyRate: number }[];
  trend30: { date: string; answeredCount: number; accuracyRate: number }[];
  typeDistribution: {
    type: QuestionType;
    count: number;
    accuracyRate: number;
  }[];
  recentRecords: PracticeRecordItem[];
}

export interface KnowledgeMasteryItem {
  tagId: string;
  tagName: string;
  totalCount: number;
  correctCount: number;
  accuracyRate: number;
  masteryLevel: 'mastered' | 'good' | 'fair' | 'weak';
}

export interface KnowledgeMasteryResponse {
  items: KnowledgeMasteryItem[];
  weakCount: number;
}

export interface LearningGoalsItem {
  dailyTarget: number;
  weeklyTarget: number;
  dailyTimeTarget: number;
  weeklyTimeTarget: number;
  todayProgress: {
    answeredCount: number;
    answeredPercent: number;
    studySeconds: number;
    studyPercent: number;
    completed: boolean;
  };
  weekProgress: {
    answeredCount: number;
    answeredPercent: number;
    studySeconds: number;
    studyPercent: number;
    completed: boolean;
  };
}

export interface UpdateLearningGoalsRequest {
  dailyTarget?: number;
  weeklyTarget?: number;
  dailyTimeTarget?: number;
  weeklyTimeTarget?: number;
}

export interface CheckinCalendarResponse {
  currentStreak: number;
  maxStreak: number;
  totalDays: number;
  calendar: { date: string; answered: number; completed: boolean }[];
}

// 错题本筛选相关
export interface WrongBookFilterOptions {
  reason?: WrongReason;
  difficulty?: DifficultyLevel;
  tagId?: string;
  bankId?: string;
}

// ==================== 错误上报 ====================

export type ErrorReportType = 'js' | 'promise' | 'resource' | 'react';

export interface ErrorReportRequest {
  message: string;
  stack?: string;
  type: ErrorReportType;
  url: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
  appVersion: string;
  environment: string;
  userFeedback?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  resourceUrl?: string;
  resourceType?: string;
}

export interface ErrorReportResponse {
  success: boolean;
}

// ==================== 性能上报 ====================

export interface PerformanceMetricItem {
  name: string;
  value: number;
  path: string;
  timestamp: string;
  metricType: 'web-vital' | 'page-load' | 'api-request';
  extra?: Record<string, string | number | boolean>;
}

export type PerformanceReportRequest = PerformanceMetricItem[];

export interface PerformanceReportResponse {
  success: boolean;
  received: number;
}

// ==================== Web Vitals 性能（结构化） ====================

export interface WebVitalsReportRequest {
  url: string;
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
  domContentLoaded?: number;
  loadComplete?: number;
  userAgent: string;
  timestamp: string;
  userId?: string;
  appVersion: string;
}

export interface WebVitalsReportResponse {
  success: boolean;
}

export interface ApiPerfRecord {
  url: string;
  method: string;
  duration: number;
  status: number;
  timestamp: string;
  userId?: string;
}

export type ApiPerfReportRequest = ApiPerfRecord[];

export interface ApiPerfReportResponse {
  success: boolean;
  received: number;
}

// ==================== 用户设置同步 ====================

export interface UserWallpaperItem {
  id: string;
  url: string;
  name: string;
}

export interface UserSettingsResponse {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  questionFontSize: 'sm' | 'md' | 'lg' | 'xl';
  voiceRate: number;
  voiceScope: 'question' | 'options' | 'analysis';
  autoReadAnalysis: boolean;
  autoSync: boolean;
  syncInterval: number;
  autoDownload: boolean;
  wallpaperType: 'none' | 'default' | 'custom';
  wallpaperUrl: string | null;
  wallpaperOpacity: number;
  wallpaperSize: 'cover' | 'contain' | 'stretch';
  userWallpapers: UserWallpaperItem[];
  wallpaperShowInPractice: boolean;
  updatedAt: string;
}

export interface UpdateUserSettingsRequest {
  theme?: string;
  fontSize?: string;
  questionFontSize?: string;
  voiceRate?: number;
  voiceScope?: string;
  autoReadAnalysis?: boolean;
  autoSync?: boolean;
  syncInterval?: number;
  autoDownload?: boolean;
  wallpaperType?: string;
  wallpaperUrl?: string | null;
  wallpaperOpacity?: number;
  wallpaperSize?: string;
  userWallpapers?: UserWallpaperItem[];
  wallpaperShowInPractice?: boolean;
}

// ==================== 智能推荐与错题重练 ====================

export type SmartRecommendReason = 'high_freq_wrong' | 'recent_wrong' | 'weak_knowledge';

export interface SmartRecommendQuestion {
  questionId: string;
  bankId: string;
  bankName: string;
  content: string;
  questionType: string;
  wrongCount: number;
  lastWrongAt?: string;
  reason: SmartRecommendReason;
  reasonText: string;
}

export interface SmartRecommendResponse {
  items: SmartRecommendQuestion[];
  totalCount: number;
  highFreqCount: number;
  recentWrongCount: number;
  weakKnowledgeCount: number;
}

export interface WrongBookPracticeResult {
  masteredCount: number;
  remainingCount: number;
  totalCount: number;
}

export interface WrongBookStreakStateResponse {
  questionId: string;
  streak: number;
  target: number;
  wrongCount: number;
}

export interface WrongBookStreakSubmitRequest {
  questionId: string;
  isCorrect: boolean;
}

export interface WrongBookStreakSubmitResponse {
  streak: number;
  mastered: boolean;
  wrongCount: number;
}

// ==================== 题库批量操作与排序 ====================

export type BankSortBy =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'question_count_desc'
  | 'question_count_asc'
  | 'name_asc'
  | 'name_desc'
  | 'last_practiced_desc'
  | 'last_practiced_asc'
  | 'accuracy_desc'
  | 'accuracy_asc';

export interface BatchBankOperationRequest {
  bankIds: string[];
  operation: 'delete' | 'move_subject' | 'set_public' | 'set_private';
  subjectId?: string | null;
}

export interface BatchBankOperationResponse {
  successCount: number;
  failCount: number;
}

export interface BankShareInfo {
  bankId: string;
  bankName: string;
  shareUrl: string;
  isPublic: boolean;
}

// ==================== 收藏分组 ====================

export interface FavoriteGroupItem {
  id: string;
  name: string;
  sortOrder: number;
  color: string;
  questionCount: number;
}

export interface FavoriteGroupListResponse {
  items: FavoriteGroupItem[];
  totalCount: number;
}

export interface CreateFavoriteGroupRequest {
  name: string;
  color?: string;
}

export interface UpdateFavoriteGroupRequest {
  name?: string;
  color?: string;
  sortOrder?: number;
}

export interface MoveFavoriteQuestionRequest {
  fromGroupId?: string | null;
  toGroupId: string;
  questionIds: string[];
}

// ==================== 用户设置补充 ====================

export interface UpdateSettingsRequest {
  theme?: string;
  fontSize?: string;
  questionFontSize?: string;
  voiceRate?: number;
  voiceScope?: string;
  autoReadAnalysis?: boolean;
  autoSync?: boolean;
  syncFrequency?: string;
  autoDownload?: boolean;
  wallpaperType?: string;
  wallpaperUrl?: string | null;
  wallpaperOpacity?: number;
  wallpaperSize?: string;
  userWallpapers?: UserWallpaperItem[];
  wallpaperShowInPractice?: boolean;
  defaultPracticeMode?: string;
  quickFlashDelay?: number;
  wrongBookStreakTarget?: number;
  bankSortBy?: BankSortBy;
}

export interface SyncStateResponse {
  lastSyncedAt?: string;
}

export interface UserDeviceListResponse {
  items: UserDeviceItem[];
}

// ==================== 反馈管理（管理员） ====================

export type FeedbackStatus = 'unread' | 'read' | 'processing' | 'resolved' | 'closed';
export type FeedbackSource = 'question' | 'general';

export interface AdminFeedbackItem {
  id: string;
  source: FeedbackSource;
  feedbackType: string;
  content: string;
  username?: string;
  userId?: string;
  questionId?: string;
  pageUrl?: string;
  userAgent?: string;
  appVersion?: string;
  errorStack?: string;
  contactInfo?: string;
  status: FeedbackStatus;
  adminReply?: string;
  handledAt?: string;
  handledByUsername?: string;
  createdAt: string;
}

export interface AdminFeedbackListRequest {
  page?: number;
  pageSize?: number;
  source?: FeedbackSource;
  status?: FeedbackStatus;
  keyword?: string;
  sort?: 'newest' | 'oldest';
}

export interface AdminFeedbackListResponse {
  items: AdminFeedbackItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminFeedbackStatusUpdateRequest {
  status: FeedbackStatus;
  adminReply?: string;
}

export interface AdminFeedbackStatusUpdateResponse {
  success: boolean;
}

export interface AdminFeedbackStatsResponse {
  total: number;
  unread: number;
  processing: number;
  resolved: number;
}

// ==================== 我的反馈（普通用户） ====================

export interface MyFeedbackItem {
  id: string;
  source: FeedbackSource;
  feedbackType: string;
  content: string;
  status: FeedbackStatus;
  adminReply?: string;
  handledAt?: string;
  createdAt: string;
}

export interface MyFeedbackListRequest {
  page?: number;
  pageSize?: number;
}

export interface MyFeedbackListResponse {
  items: MyFeedbackItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== 题目编辑 v1.6.0 ====================

export interface UpdateQuestionFullRequest {
  content?: string;
  questionType?: QuestionType;
  options?: QuestionOption[];
  correctAnswers?: number[];
  analysis?: string;
  subQuestions?: SubQuestion[];
  knowledgePoints?: string;
  unitName?: string | null;
  confirm?: boolean;
}

export interface UpdateQuestionResponse {
  success: boolean;
  question?: QuestionItem;
  hasAnswerRecords?: boolean;
}

export interface BatchReplaceRequest {
  bankId: string;
  knowledgePoint?: string;
  analysisTemplate?: string;
  replaceTextFrom?: string;
  replaceTextTo?: string;
  addTags?: string[];
  removeTags?: string[];
}

export interface BatchReplacePreviewResponse {
  affectedCount: number;
  sampleQuestions: QuestionItem[];
}

export interface BatchReplaceResponse {
  successCount: number;
  failCount: number;
  failReasons: { questionId: string; reason: string }[];
}

export interface BatchDeleteQuestionsRequest {
  questionIds: string[];
}

export interface BatchDeleteQuestionsResponse {
  successCount: number;
  failCount: number;
}

export interface QuestionItemV2 extends QuestionItem {
  knowledgePoints: string;
  unitName?: string | null;
  sortOrder: number;
}

export interface QuestionListV2Response {
  items: QuestionItemV2[];
  total: number;
}

// ==================== 题库协作 v1.6.0 ====================

export interface EditRequestItem {
  id: string;
  bankId: string;
  bankName: string;
  userId: string;
  username: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerId?: string;
  reviewerUsername?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface EditRequestListResponse {
  items: EditRequestItem[];
  total: number;
}

export interface SubmitEditRequestRequest {
  bankId: string;
  reason: string;
}

export interface SubmitEditRequestResponse {
  id: string;
  status: string;
}

export interface ReviewEditRequestRequest {
  requestId: string;
  action: 'approve' | 'reject';
  reviewNote?: string;
}

export interface ReviewEditRequestResponse {
  success: boolean;
}

export interface CollaboratorItem {
  id: string;
  bankId: string;
  userId: string;
  username: string;
  permission: string;
  joinedAt: string;
}

export interface CollaboratorListResponse {
  items: CollaboratorItem[];
}

export interface RemoveCollaboratorRequest {
  collaboratorId: string;
}

export interface RemoveCollaboratorResponse {
  success: boolean;
}

export interface BankVersionItem {
  id: string;
  bankId: string;
  versionNumber: number;
  changeSummary: string;
  questionCount: number;
  createdByUserId?: string;
  createdByUsername?: string;
  createdAt: string;
}

export interface BankVersionListResponse {
  items: BankVersionItem[];
  total: number;
}

export interface BankVersionDetailResponse {
  id: string;
  versionNumber: number;
  changeSummary: string;
  questionCount: number;
  questions: QuestionItemV2[];
  createdAt: string;
}

export interface RollbackVersionRequest {
  versionId: string;
}

export interface RollbackVersionResponse {
  success: boolean;
  newVersionNumber: number;
}

export interface BankRatingItem {
  id: string;
  bankId: string;
  userId: string;
  username: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface BankRatingListResponse {
  items: BankRatingItem[];
  total: number;
  avgRating: number;
  ratingCount: number;
}

export interface SubmitRatingRequest {
  bankId: string;
  rating: number;
  comment?: string;
}

export interface SubmitRatingResponse {
  id: string;
  avgRating: number;
  ratingCount: number;
}

export interface DeleteRatingResponse {
  success: boolean;
  avgRating: number;
  ratingCount: number;
}

// ==================== 管理员操作日志 v1.6.0 ====================

export type AdminOperationType = 'delete_bank' | 'delete_question' | 'delete_user' | 'delete_feedback' | 'change_user_role' | 'kick_device' | 'rollback_bank_version' | 'approve_edit_request' | 'reject_edit_request' | 'remove_collaborator' | 'change_bank_public';

export interface AdminOperationLogItem {
  id: string;
  adminId: string;
  adminUsername: string;
  operationType: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  operationDetail?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AdminOperationLogListRequest {
  page?: number;
  pageSize?: number;
  operationType?: string;
  adminId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminOperationLogListResponse {
  items: AdminOperationLogItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== 系统日志 v1.9.0 ====================

export type SystemLogType = 'login' | 'logout' | 'data_change' | 'import' | 'export' | 'anomaly';

export interface SystemLogItem {
  id: string;
  logType: SystemLogType;
  action: string;
  userId?: string;
  username?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;
  detail?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

export interface SystemLogListRequest {
  page?: number;
  pageSize?: number;
  logType?: SystemLogType;
  logTypes?: SystemLogType[];
  username?: string;
  status?: 'success' | 'failed';
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface SystemLogListResponse {
  items: SystemLogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SystemLogStatsResponse {
  todayTotal: number;
  todayLogin: number;
  todayAnomaly: number;
  last7Days: { date: string; count: number }[];
}

export type SystemLogExportFormat = 'csv' | 'excel' | 'json';

export interface SystemLogExportRequest {
  format: SystemLogExportFormat;
  logType?: SystemLogType;
  logTypes?: SystemLogType[];
  username?: string;
  status?: 'success' | 'failed';
  startDate?: string;
  endDate?: string;
  keyword?: string;
  ids?: string[];
}

// ==================== 数据隔离检查 ====================

export interface DataIsolationCheckResult {
  passed: boolean;
  issues: { module: string; endpoint: string; issue: string; severity: 'high' | 'medium' | 'low' }[];
}
