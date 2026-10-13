# hyacine小助手

一款支持多题集管理的个人自学自测 Web 应用。

## 功能特性

- 多题型支持：单选、多选、判断、填空、B1 型配伍题
- 多种练习模式：基础模式 / 速记模式 / 速读模式 / 随机抽题 / 错题重练
- 题集管理：创建、编辑、删除，支持科目分类
- 批量导入：JSON / Excel / CSV / Word 智能识别
- 错题本：自动记录错题，支持重练
- 收藏分组：多收藏夹管理
- 标签系统：公有 / 私有标签，按标签浏览题目
- 数据统计：正确率趋势、各题库进度、打卡日历
- 个性化设置：壁纸、字体大小、深浅主题、每日打卡目标
- 账号系统：注册 / 登录 / 设备管理 / 游客模式

## 技术栈

**前端**
- React 19 + TypeScript
- React Router DOM v6
- Tailwind CSS + shadcn/ui
- Lucide React 图标
- Axios（axiosForBackend）

**后端**
- NestJS 10 + TypeScript
- Drizzle ORM + PostgreSQL
- JWT 鉴权（HS256 + 设备管理）
- PBKDF2-SHA256 密码哈希

## 项目结构

```
├── client/          # React 前端
│   ├── index.html
│   ├── public/      # 静态资源
│   └── src/         # 前端源代码
│       ├── api/         # API 请求
│       ├── pages/       # 页面
│       ├── components/  # 组件
│       ├── hooks/       # 自定义 hooks
│       ├── utils/       # 工具函数
│       ├── context/     # 全局状态
│       └── ...
├── server/          # NestJS 后端
│   ├── main.ts
│   ├── app.module.ts
│   ├── modules/     # 业务模块
│   ├── database/    # 数据库 schema
│   └── common/      # 通用工具
├── shared/          # 前后端共享类型
├── package.json     # 根配置
├── vite.config.ts   # 前端构建配置
├── nest-cli.json    # 后端构建配置
├── tsconfig.json    # TypeScript 配置
└── tailwind.config.ts
```

## 本地运行

### 环境要求

- Node.js >= 22.0.0
- PostgreSQL

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

前端默认运行在 Vite dev server，后端运行在 NestJS。

### 构建

```bash
npm run build
```

## 数据库

使用 Drizzle ORM，schema 定义在 `server/database/schema.ts`。

## 安全说明

- 密码使用 PBKDF2-SHA256 哈希（10000 轮迭代 + 独立随机 salt）
- JWT HS256 签名，7 天有效期，timingSafeEqual 防时序攻击
- 修改密码自动下线其他设备
- 文件上传类型白名单 + 大小限制（20MB）
- Drizzle ORM 参数化查询防 SQL 注入
- React 默认 XSS 转义

> 本工具仅用于个人学习自测，禁止用于任何正式考试或作弊行为。
