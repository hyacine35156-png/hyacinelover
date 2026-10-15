# 技术方案

## 开发元信息
- 开发模式: 全栈应用
- 涉及层级: [数据库, 服务端, 前端]

## 页面路由与导航

### 页面路由
| 页面 | 路径 | 说明 |
|------|------|------|
| 题库管理 | /banks | 首页，展示题库列表，支持文件导入和手动录入 |
| 刷题练习 | /practice/:bankId | 逐题作答页面，展示题目与选项，提交后显示解析 |
| 答题记录 | /records | 展示正确率统计与答题历史记录 |

### 导航设计
- 导航机制：页面路由
- 导航项：
  - 题库管理（/banks）
  - 答题记录（/records）

## 数据模型

### 数据库设计

#### 题库表（question_bank）
用途：存储题库的基本信息，每个题库包含若干题目。
核心字段：
- name: varchar (题库名称)
- description: text (题库描述，可选)
- question_count: integer (题目数量，冗余字段便于列表展示)

#### 题目表（question）
用途：存储每道题的题干、选项、答案和解析。
核心字段：
- bank_id: uuid (所属题库ID，外键关联 question_bank)
- content: text (题干内容)
- question_type: varchar ['single', 'multiple'] (题型：单选/多选)
- options: jsonb (选项列表，数组格式，每项含 label 和 text)
- correct_answers: jsonb (正确答案索引数组，如 [0, 2])
- analysis: text (答案解析，可选)
关联关系：与题库表是多对一的关系，多个题目属于一个题库

#### 练习记录表（practice_record）
用途：记录用户每次刷题的整体结果。
核心字段：
- bank_id: uuid (所属题库ID)
- user_id: user_profile (答题用户)
- total_count: integer (本次答题总题数)
- correct_count: integer (答对题数)
- accuracy_rate: numeric (正确率，0-1之间的小数)
- duration_seconds: integer (答题用时，秒)
- started_at: timestamp (开始时间)
- finished_at: timestamp (结束时间)

#### 练习答题明细表（practice_answer）
用途：记录每次练习中每道题的作答详情。
核心字段：
- record_id: uuid (练习记录ID，外键关联 practice_record)
- question_id: uuid (题目ID)
- user_answers: jsonb (用户选择的答案索引数组)
- is_correct: boolean (是否答对)

## 业务模型

### API 设计

#### 题库管理页相关
**页面路径**: /banks
**功能全景**：
| 功能 | 实现方式 | 说明 |
|------|----------|------|
| 获取题库列表 | API | GET /api/question-banks |
| 删除题库 | API | DELETE /api/question-banks/:id |
| 文件导入题库 | API | POST /api/question-banks/import |
| 手动录入题目 | API | POST /api/question-banks/:id/questions |
| 创建空题库 | API | POST /api/question-banks |

**所需 API**:
```typescript
// 获取题库列表 [领域模型: QuestionBankModel] [对应页面功能: 题库卡片网格展示]
GET /api/question-banks
Response: { items: Array<{ id: string; name: string; description: string; questionCount: number; createdAt: string }> }

// 创建空题库 [领域模型: QuestionBankModel] [对应页面功能: 手动录入时先创建题库]
POST /api/question-banks
Request: { name: string; description?: string }
Response: { id: string; name: string; questionCount: number; createdAt: string }

// 删除题库 [领域模型: QuestionBankModel] [对应页面功能: 删除题库]
DELETE /api/question-banks/:id
Response: { success: boolean }

// 文件导入题库 [领域模型: QuestionBankModel + QuestionModel] [对应页面功能: 文件导入]
POST /api/question-banks/import (multipart/form-data)
Request: { file: File; name: string }
Response: { bankId: string; successCount: number; failCount: number; failures: Array<{ row: number; reason: string }> }

// 手动添加题目 [领域模型: QuestionModel] [对应页面功能: 手动录入题目]
POST /api/question-banks/:id/questions
Request: { content: string; questionType: 'single' | 'multiple'; options: Array<{ label: string; text: string }>; correctAnswers: number[]; analysis?: string }
Response: { id: string; content: string }
```

#### 刷题练习页相关
**页面路径**: /practice/:bankId
**功能全景**：
| 功能 | 实现方式 | 说明 |
|------|----------|------|
| 获取题库全部题目 | API | GET /api/question-banks/:id/questions |
| 提交练习结果 | API | POST /api/practice-records |

**所需 API**:
```typescript
// 获取题库下所有题目 [领域模型: QuestionModel] [对应页面功能: 逐题展示题目和选项]
GET /api/question-banks/:id/questions
Response: { items: Array<{ id: string; content: string; questionType: 'single' | 'multiple'; options: Array<{ label: string; text: string }>; correctAnswers: number[]; analysis: string }> }

// 提交练习记录 [领域模型: PracticeRecordModel + PracticeAnswerModel] [对应页面功能: 保存答题结果与正确率]
POST /api/practice-records
Request: { bankId: string; totalCount: number; correctCount: number; accuracyRate: number; durationSeconds: number; startedAt: string; finishedAt: string; answers: Array<{ questionId: string; userAnswers: number[]; isCorrect: boolean }> }
Response: { id: string; accuracyRate: number; correctCount: number; totalCount: number }
```

#### 答题记录页相关
**页面路径**: /records
**功能全景**：
| 功能 | 实现方式 | 说明 |
|------|----------|------|
| 获取统计概览 | API | GET /api/practice-records/statistics |
| 获取练习记录列表 | API | GET /api/practice-records |
| 获取单条记录详情 | API | GET /api/practice-records/:id |

**所需 API**:
```typescript
// 获取统计概览 [领域模型: PracticeRecordModel] [对应页面功能: 数据概览卡片 + 题库正确率排行]
GET /api/practice-records/statistics
Response: { totalQuestions: number; totalAccuracyRate: number; practicedBanks: number; bankStats: Array<{ bankId: string; bankName: string; accuracyRate: number; totalCount: number }> }

// 获取练习记录列表 [领域模型: PracticeRecordModel] [对应页面功能: 历史记录列表]
GET /api/practice-records?page=1&pageSize=20
Response: { items: Array<{ id: string; bankId: string; bankName: string; totalCount: number; correctCount: number; accuracyRate: number; durationSeconds: number; finishedAt: string }>; total: number }

// 获取练习记录详情 [领域模型: PracticeRecordModel + PracticeAnswerModel] [对应页面功能: 查看每次答题详情]
GET /api/practice-records/:id
Response: { id: string; bankName: string; totalCount: number; correctCount: number; accuracyRate: number; finishedAt: string; answers: Array<{ questionId: string; questionContent: string; userAnswers: number[]; correctAnswers: number[]; isCorrect: boolean; options: Array<{ label: string; text: string }> }> }
```
