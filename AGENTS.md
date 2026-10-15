# UI 设计指南 - hyacine小助手

## 设计原型

- **目标用户**: 自学者、知识整理人群、学习爱好者
- **核心目的**: 自测练习、错题整理、收藏回顾、数据统计
- **情绪基调**: 清爽专注 / 高效学习 / 舒适护眼

## 应用概览

hyacine小助手是一款支持多题集管理的个人自学自测 Web 应用。支持多种题型（单选/多选/判断/填空/B1型题），提供多种练习模式（基础模式/速记模式/速读模式），配套错题本、收藏分组、标签管理、智能推荐、学习统计等功能。

**重要声明**：本工具仅用于个人学习自测，禁止用于任何正式考试或作弊行为。

## 技术架构

### 前端
- React 19 + TypeScript + React Router DOM v6
- Tailwind CSS + shadcn/ui 组件库
- Lucide React 图标库
- Axios 请求封装（axiosForBackend）
- Context 状态管理（Auth/Theme/FontSize/Wallpaper）

### 后端
- NestJS 10 + TypeScript + Drizzle ORM
- PostgreSQL 数据库
- JWT 鉴权（HS256 + 设备管理）
- PBKDF2-SHA256 密码哈希

## 色彩系统

简洁清爽的浅色主题，支持深色模式切换。以蓝紫主色搭配中性灰，保持阅读舒适度。

| Token | 说明 |
|-------|------|
| `--primary` | 主色调（蓝紫），用于按钮、链接、选中态 |
| `--background` | 页面背景色 |
| `--foreground` | 主文字色 |
| `--muted-foreground` | 次级文字色 |
| `--card` | 卡片背景 |
| `--border` | 边框色 |
| `--accent` | 悬停/强调色 |
| `--destructive` | 危险操作红 |
| `--success` | 正确/通过绿 |
| `--warning` | 警告/错误橙 |

## 字体排版

- **字体**: Inter, "Noto Sans SC", system-ui, sans-serif
- **字号层级**: 
  - 标题: text-lg / text-xl / text-2xl，font-semibold
  - 正文: text-sm / text-base，font-normal
  - 辅助: text-xs，text-muted-foreground
- **行高**: 标题 1.3，正文 1.6

## 布局策略

- **导航**: 顶部固定导航栏，左侧品牌 Logo，中间主导航，右侧用户菜单
- **移动端**: 底部 Tab 栏（5个主要入口），顶部精简导航
- **内容容器**: max-w-6xl 居中，px-4 / sm:px-6 左右内边距
- **间距基准**: 4px 基础单位（tailwind 的 spacing scale）

## 页面路由

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录 | `/login` | 公开 |
| 注册 | `/register` | 公开 |
| 我的题集 | `/banks` | 首页 |
| 临时题集 | `/temporary` | 随机抽题生成 |
| 收藏 | `/favorites` | 收藏分组 + 题目列表 |
| 错题本 | `/wrongbook` | 错题重练 |
| 标签 | `/tags` | 标签列表 |
| 标签详情 | `/tags/:tagId` | 某标签下的题目 |
| 科目 | `/subjects` | 科目管理 |
| 搜索 | `/search` | 全站题目搜索 |
| 练习 | `/practice/:bankId` | 练习主界面 |
| 数据统计 | `/stats` | 学习数据看板 |
| 设置 | `/settings` | 壁纸/字体/主题/打卡 |
| 设备管理 | `/settings/devices` | 登录设备列表 |
| 我的反馈 | `/settings/my-feedback` | 用户提交的反馈 |
| 反馈管理 | `/admin/feedback` | 管理员后台（仅 admin） |
| 学习记录 | `/records` | 练习历史记录 |

## 核心功能模块

### 账号系统
- 注册/登录/登出/修改密码
- 多账号切换（本地保存）
- 设备管理（多设备登录、下线其他设备）
- 游客模式（纯前端，部分功能只读）
- JWT 鉴权 + 设备 token 校验

### 题集系统
- 多题集管理（创建、编辑、删除）
- 支持题型：单选、多选、判断、填空、B1型配伍题
- 题目难度、解析、标签
- 科目分类

### 导入系统
- 支持格式：JSON、Excel(xlsx/xls)、CSV、Word(docx)
- Word 智能识别：正则匹配题号、选项、答案，支持单选/多选/B1型
- 单次导入上限：20MB / 2000 题
- 导入预览（Word 格式）

### 练习模式
- 基础模式：顺序练习，显示答案解析
- 速记模式：先看题再显示答案，适合记忆
- 速读模式：快速过题，仅标记对错
- 随机抽题：从题集随机抽取生成临时题集
- 错题重练：从错题本抽题练习

### 错题本与收藏
- 自动记录错题（wrongCount）
- 错题重练入口
- 收藏分组（可创建多个收藏夹）
- 收藏题目管理

### 标签系统
- 公有标签 + 私有标签
- 题目可打多个标签
- 标签详情页浏览同标签题目

### 数据统计
- 总题数、已掌握、错题数
- 正确率趋势
- 各题库进度
- 打卡日历

### 设置
- 壁纸设置（内置壁纸 + 自定义上传）
- 字体大小调节
- 主题切换（浅色/深色）
- 每日打卡目标
- 数据同步

### 反馈系统
- 用户提交反馈（题目纠错 / 通用反馈）
- 管理员反馈管理后台（状态流转、回复）

## 组件规范

- 使用 shadcn/ui 组件库，按功能使用，样式 heavily style
- 按钮使用 variant/size API，不手动控制 padding/height
- 卡片不嵌套卡片
- 表单使用 React Hook Form + Zod（forms-skill）
- 表格使用 @lark-apaas/client-toolkit/antd-table（table-skill）
- 数据加载使用 Spinner 组件
- 空状态有明确提示和引导操作

## 安全措施

- 密码 PBKDF2-SHA256 哈希，10000 轮迭代，salt 独立随机
- JWT HS256 签名，7 天有效期，timingSafeEqual 防时序攻击
- 改密码自动下线其他设备（删除 user_device 记录）
- 文件上传类型白名单 + 大小限制（20MB）
- Drizzle ORM 参数化查询防 SQL 注入
- React 默认 XSS 转义
