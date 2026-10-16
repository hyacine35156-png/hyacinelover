/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const systemLog = pgTable("system_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  logType: varchar("log_type", { length: 30 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  userId: uuid("user_id"),
  username: varchar("username", { length: 50 }),
  targetType: varchar("target_type", { length: 50 }),
  targetId: uuid("target_id"),
  targetName: varchar("target_name", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: varchar("user_agent", { length: 500 }),
  deviceInfo: jsonb("device_info").notNull().default('{}'),
  detail: text("detail"),
  status: varchar("status", { length: 20 }).notNull().default('success'),
  errorMessage: text("error_message"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_system_log_user_id").on(table.userId),
  index("idx_system_log_log_type").on(table.logType),
  index("idx_system_log_status").on(table.status),
  index("idx_system_log_created_at").on(table.createdAt),
  index("idx_system_log_username").on(table.username),
  index("idx_system_log_target").on(table.targetType, table.targetId),
]);

export const adminOperationLog = pgTable("admin_operation_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: userProfile("admin_id").notNull(),
  adminUsername: varchar("admin_username", { length: 50 }).notNull(),
  operationType: varchar("operation_type", { length: 50 }).notNull(),
  targetType: varchar("target_type", { length: 50 }),
  targetId: uuid("target_id"),
  targetName: varchar("target_name", { length: 255 }),
  operationDetail: text("operation_detail"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: varchar("user_agent", { length: 500 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  // Complex index: CREATE INDEX idx_admin_log_admin ON admin_operation_log USING btree (((admin_id).user_id)),
  index("idx_admin_log_type").on(table.operationType),
  index("idx_admin_log_created").on(table.createdAt),
  index("idx_admin_log_target").on(table.targetType, table.targetId),
]);

export const questionBankRating = pgTable("question_bank_rating", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankId: uuid("bank_id").notNull(),
  userId: userProfile("user_id").notNull(),
  appUserId: uuid("app_user_id"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_qb_rating_bank_user").on(table.bankId, table.appUserId),
  index("idx_qb_rating_app_user").on(table.appUserId),
  foreignKey({
    columns: [table.bankId],
    foreignColumns: [questionBank.id],
    name: "question_bank_rating_bank_id_fkey",
  }).onDelete("cascade"),
]);

export const questionBankVersion = pgTable("question_bank_version", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankId: uuid("bank_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  /**
   * @type { questions: Array<{ content: string; questionType: string; options: Array<{ label: string; text: string }>; correctAnswers: number[]; analysis: string; subQuestions: Array<{ content: string; correctAnswer: string; analysis: string }>; knowledgePoints: string; unitName: string | null }> }
   */
  snapshot: jsonb("snapshot").notNull(),
  changeSummary: varchar("change_summary", { length: 255 }).notNull(),
  questionCount: integer("question_count").notNull().default(0),
  createdBy: userProfile("created_by"),
  appUserId: uuid("app_user_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_qb_version_bank_num").on(table.bankId, table.versionNumber),
  index("idx_qb_version_bank_created").on(table.bankId, table.createdAt),
  index("idx_qb_version_app_user").on(table.appUserId),
  index("idx_question_bank_version_bank_id").on(table.bankId),
  foreignKey({
    columns: [table.bankId],
    foreignColumns: [questionBank.id],
    name: "question_bank_version_bank_id_fkey",
  }).onDelete("cascade"),
]);

export const questionBankEditRequest = pgTable("question_bank_edit_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankId: uuid("bank_id").notNull(),
  userId: userProfile("user_id").notNull(),
  appUserId: uuid("app_user_id"),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  reviewerId: userProfile("reviewer_id"),
  reviewedAt: customTimestamptz("reviewed_at", { precision: 3 }),
  reviewNote: text("review_note"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_qb_edit_request_bank").on(table.bankId),
  // Complex index: CREATE INDEX idx_qb_edit_request_user ON question_bank_edit_request USING btree (((user_id).user_id)),
  index("idx_qb_edit_request_status").on(table.status),
  index("idx_qb_edit_request_app_user").on(table.appUserId),
  foreignKey({
    columns: [table.bankId],
    foreignColumns: [questionBank.id],
    name: "question_bank_edit_request_bank_id_fkey",
  }).onDelete("cascade"),
]);

export const questionBankCollaborator = pgTable("question_bank_collaborator", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankId: uuid("bank_id").notNull(),
  userId: userProfile("user_id").notNull(),
  appUserId: uuid("app_user_id"),
  permission: varchar("permission", { length: 20 }).notNull().default('edit'),
  joinedAt: customTimestamptz("joined_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_qb_collaborator_bank_user").on(table.bankId, table.appUserId),
  index("idx_qb_collaborator_app_user").on(table.appUserId),
  foreignKey({
    columns: [table.bankId],
    foreignColumns: [questionBank.id],
    name: "question_bank_collaborator_bank_id_fkey",
  }).onDelete("cascade"),
]);

export const favoriteGroupItem = pgTable("favorite_group_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  questionId: uuid("question_id").notNull(),
  appUserId: uuid("app_user_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_favorite_group_item_gq").on(table.groupId, table.questionId),
  index("idx_favorite_group_item_question").on(table.questionId),
  index("idx_favorite_group_item_app_user").on(table.appUserId),
  index("idx_favorite_group_item_group_id").on(table.groupId),
  foreignKey({
    columns: [table.groupId],
    foreignColumns: [favoriteGroup.id],
    name: "favorite_group_item_group_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.questionId],
    foreignColumns: [question.id],
    name: "favorite_group_item_question_id_fkey",
  }).onDelete("cascade"),
]);

export const favoriteGroup = pgTable("favorite_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userProfile("user_id").notNull(),
  appUserId: uuid("app_user_id"),
  name: varchar("name", { length: 50 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  color: varchar("color", { length: 20 }).default('blue'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE INDEX idx_favorite_group_user ON favorite_group USING btree (((user_id).user_id)),
  index("idx_favorite_group_app_user").on(table.appUserId),
  // Complex index: CREATE UNIQUE INDEX idx_favorite_group_user_name ON favorite_group USING btree (((user_id).user_id), name),
]);

export const clientApiPerf = pgTable("client_api_perf", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiPath: varchar("api_path", { length: 500 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  durationMs: integer("duration_ms").notNull(),
  statusCode: integer("status_code").notNull(),
  userId: uuid("user_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_client_api_perf_created").on(table.createdAt),
  index("idx_client_api_perf_path").on(table.apiPath),
]);

export const clientPerfLog = pgTable("client_perf_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageUrl: varchar("page_url", { length: 500 }).notNull(),
  lcp: numeric("lcp"),
  fid: numeric("fid"),
  cls: numeric("cls"),
  ttfb: numeric("ttfb"),
  domContentLoaded: numeric("dom_content_loaded"),
  loadComplete: numeric("load_complete"),
  userAgent: varchar("user_agent", { length: 500 }),
  userId: uuid("user_id"),
  appVersion: varchar("app_version", { length: 50 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_client_perf_created").on(table.createdAt),
]);

export const clientErrorLog = pgTable("client_error_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  errorType: varchar("error_type", { length: 20 }).notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  pageUrl: text("page_url").notNull(),
  userAgent: varchar("user_agent", { length: 500 }),
  userId: uuid("user_id"),
  appVersion: varchar("app_version", { length: 50 }),
  environment: varchar("environment", { length: 20 }),
  userFeedback: text("user_feedback"),
  status: varchar("status", { length: 20 }).notNull().default('unread'),
  adminReply: text("admin_reply"),
  handledAt: customTimestamptz("handled_at", { precision: 3 }),
  handledBy: uuid("handled_by"),
  feedbackCategory: varchar("feedback_category", { length: 20 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_client_error_created").on(table.createdAt),
  index("idx_client_error_type").on(table.errorType),
  index("idx_client_error_log_status").on(table.status),
  foreignKey({
    columns: [table.handledBy],
    foreignColumns: [appUser.id],
    name: "client_error_log_handled_by_fkey",
  }),
]);

export const userSyncState = pgTable("user_sync_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  lastSyncedAt: customTimestamptz("last_synced_at", { precision: 3 }),
  /**
   * @type { Record<string, unknown> }
   */
  pendingChanges: jsonb("pending_changes").notNull().default('{}'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("user_sync_state_user_id_key").on(table.userId),
  index("idx_user_sync_user").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [appUser.id],
    name: "user_sync_state_user_id_fkey",
  }).onDelete("cascade"),
]);

export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  theme: varchar("theme", { length: 20 }).default('system'),
  fontSize: varchar("font_size", { length: 10 }).default('md'),
  questionFontSize: varchar("question_font_size", { length: 10 }).default('md'),
  voiceRate: numeric("voice_rate").default('1.0'),
  voiceScope: varchar("voice_scope", { length: 20 }).default('options'),
  autoReadAnalysis: boolean("auto_read_analysis").default(false),
  autoSync: boolean("auto_sync").default(true),
  syncInterval: integer("sync_interval").default(300),
  autoDownload: boolean("auto_download").default(false),
  syncFrequency: varchar("sync_frequency", { length: 20 }).notNull().default('realtime'),
  wallpaperType: varchar("wallpaper_type", { length: 20 }).notNull().default('none'),
  wallpaperUrl: text("wallpaper_url"),
  wallpaperOpacity: integer("wallpaper_opacity").notNull().default(40),
  wallpaperSize: varchar("wallpaper_size", { length: 20 }).notNull().default('cover'),
  /**
   * @type { id: string; url: string; name: string }[]
   */
  userWallpapers: jsonb("user_wallpapers").notNull().default('[]'),
  wallpaperShowInPractice: boolean("wallpaper_show_in_practice").notNull().default(false),
  defaultPracticeMode: varchar("default_practice_mode", { length: 20 }).notNull().default('basic'),
  quickFlashDelay: integer("quick_flash_delay").notNull().default(800),
  wrongBookStreakTarget: integer("wrong_book_streak_target").notNull().default(3),
  bankSortBy: varchar("bank_sort_by", { length: 30 }).notNull().default('created_at_desc'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("user_settings_user_id_key").on(table.userId),
  index("idx_user_settings_user").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [appUser.id],
    name: "user_settings_user_id_fkey",
  }).onDelete("cascade"),
]);

export const userDevice = pgTable("user_device", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  deviceId: varchar("device_id", { length: 100 }).notNull(),
  deviceName: varchar("device_name", { length: 100 }).notNull(),
  browser: varchar("browser", { length: 50 }),
  os: varchar("os", { length: 50 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  lastActiveAt: customTimestamptz("last_active_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  userAgent: varchar("user_agent", { length: 500 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_user_device_user_device").on(table.userId, table.deviceId),
  index("idx_user_device_user").on(table.userId),
  index("idx_user_device_token").on(table.tokenHash),
  index("idx_user_device_last_active").on(table.lastActiveAt),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [appUser.id],
    name: "user_device_user_id_fkey",
  }).onDelete("cascade"),
]);

export const questionComment = pgTable("question_comment", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull(),
  appUserId: uuid("app_user_id").notNull(),
  content: text("content").notNull(),
  questionHash: varchar("question_hash", { length: 64 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_question_comment_question").on(table.questionId),
  index("idx_question_comment_user").on(table.appUserId),
  index("idx_question_comment_hash").on(table.questionHash),
  index("idx_question_comment_question_id").on(table.questionId),
  foreignKey({
    columns: [table.questionId],
    foreignColumns: [question.id],
    name: "question_comment_question_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.appUserId],
    foreignColumns: [appUser.id],
    name: "question_comment_app_user_id_fkey",
  }).onDelete("cascade"),
]);

export const questionFeedback = pgTable("question_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull(),
  userId: userProfile("user_id").notNull(),
  feedbackType: varchar("feedback_type", { length: 30 }).notNull(),
  description: text("description").notNull(),
  appUserId: uuid("app_user_id"),
  status: varchar("status", { length: 20 }).notNull().default('unread'),
  adminReply: text("admin_reply"),
  handledAt: customTimestamptz("handled_at", { precision: 3 }),
  handledBy: uuid("handled_by"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_question_feedback_question").on(table.questionId),
  // Complex index: CREATE INDEX idx_question_feedback_user ON question_feedback USING btree (((user_id).user_id)),
  index("idx_question_feedback_app_user").on(table.appUserId),
  index("idx_question_feedback_status").on(table.status),
  foreignKey({
    columns: [table.handledBy],
    foreignColumns: [appUser.id],
    name: "question_feedback_handled_by_fkey",
  }),
]);

export const dailyAnswerRecord = pgTable("daily_answer_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  answerDate: date("answer_date").notNull(),
  questionId: uuid("question_id").notNull(),
  answeredAt: customTimestamptz("answered_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("daily_answer_record_user_id_answer_date_question_id_key").on(table.userId, table.answerDate, table.questionId),
  index("idx_daily_answer_user_date").on(table.userId, table.answerDate),
]);

export const checkinSetting = pgTable("checkin_setting", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  dailyTarget: integer("daily_target").notNull().default(10),
  weeklyTarget: integer("weekly_target").notNull().default(50),
  dailyTimeTarget: integer("daily_time_target").notNull().default(30),
  weeklyTimeTarget: integer("weekly_time_target").notNull().default(180),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("checkin_setting_user_id_key").on(table.userId),
]);

export const appUser = pgTable("app_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default('user'),
  uid: varchar("uid", { length: 20 }).unique(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("app_user_username_key").on(table.username),
  index("idx_app_user_role").on(table.role),
  uniqueIndex("app_user_uid_idx").on(table.uid),
]);

export const subject = pgTable("subject", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).notNull().default('blue'),
  icon: varchar("icon", { length: 50 }),
  ownerUserId: userProfile("owner_user_id").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  appUserId: uuid("app_user_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE UNIQUE INDEX subject_owner_name_idx ON subject USING btree (((owner_user_id).user_id), name),
  index("idx_subject_app_user").on(table.appUserId),
]);

export const questionTagRel = pgTable("question_tag_rel", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull(),
  tagId: uuid("tag_id").notNull(),
  appUserId: uuid("app_user_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("question_tag_rel_question_tag_idx").on(table.questionId, table.tagId),
  index("idx_question_tag_rel_tag").on(table.tagId),
  index("idx_question_tag_rel_app_user").on(table.appUserId),
  index("idx_question_tag_rel_question").on(table.questionId),
  foreignKey({
    columns: [table.questionId],
    foreignColumns: [question.id],
    name: "question_tag_rel_question_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.tagId],
    foreignColumns: [questionTag.id],
    name: "question_tag_rel_tag_id_fkey",
  }).onDelete("cascade"),
]);

export const questionTag = pgTable("question_tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).notNull().default('blue'),
  ownerUserId: userProfile("owner_user_id").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  labelType: varchar("label_type", { length: 20 }).notNull().default('private'),
  appUserId: uuid("app_user_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE UNIQUE INDEX question_tag_owner_name_idx ON question_tag USING btree (((owner_user_id).user_id), name),
  // Complex index: CREATE INDEX idx_question_tag_owner ON question_tag USING btree (((owner_user_id).user_id)),
  index("idx_question_tag_label_type").on(table.labelType),
  index("idx_question_tag_app_user").on(table.appUserId),
]);

export const userQuestionState = pgTable("user_question_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userProfile("user_id").notNull(),
  questionId: uuid("question_id").notNull(),
  isFavorited: boolean("is_favorited").notNull().default(false),
  wrongCount: integer("wrong_count").notNull().default(0),
  lastWrongAt: customTimestamptz("last_wrong_at", { precision: 6 }),
  mastered: boolean("mastered").notNull().default(false),
  manuallyMastered: boolean("manually_mastered").notNull().default(false),
  appUserId: uuid("app_user_id"),
  attemptCount: integer("attempt_count").notNull().default(0),
  note: text("note"),
  difficulty: varchar("difficulty", { length: 20 }).default('medium'),
  wrongReason: varchar("wrong_reason", { length: 50 }),
  correctStreak: integer("correct_streak").notNull().default(0),
  lastPracticedAt: customTimestamptz("last_practiced_at", { precision: 3 }),
}, (table) => [
  uniqueIndex("user_question_state_user_id_question_id_key").on(table.userId, table.questionId),
  // Complex index: CREATE INDEX idx_user_question_state_user_fav ON user_question_state USING btree (((user_id).user_id), is_favorited) WHERE (is_favorited = true),
  // Complex index: CREATE INDEX idx_user_question_state_user_wrong ON user_question_state USING btree (((user_id).user_id), wrong_count) WHERE ((wrong_count > 0) AND (mastered = false)),
  index("idx_user_question_state_app_user").on(table.appUserId),
  index("idx_user_question_state_question").on(table.questionId),
  index("idx_user_question_state_wrong").on(table.appUserId, table.wrongCount),
  foreignKey({
    columns: [table.questionId],
    foreignColumns: [question.id],
    name: "user_question_state_question_id_fkey",
  }).onDelete("cascade"),
]);

export const practiceAnswer = pgTable("practice_answer", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordId: uuid("record_id").notNull(),
  questionId: uuid("question_id").notNull(),
  /**
   * @type number[]
   */
  userAnswers: jsonb("user_answers").notNull().default('[]'),
  isCorrect: boolean("is_correct").notNull().default(false),
  appUserId: uuid("app_user_id"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_practice_answer_record_question").on(table.recordId, table.questionId),
  index("idx_practice_answer_record_id").on(table.recordId),
  index("idx_practice_answer_app_user").on(table.appUserId),
  foreignKey({
    columns: [table.recordId],
    foreignColumns: [practiceRecord.id],
    name: "practice_answer_record_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.questionId],
    foreignColumns: [question.id],
    name: "practice_answer_question_id_fkey",
  }).onDelete("cascade"),
]);

export const practiceRecord = pgTable("practice_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankId: uuid("bank_id").notNull(),
  userId: userProfile("user_id").notNull(),
  totalCount: integer("total_count").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  accuracyRate: numeric("accuracy_rate").notNull().default('0'),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  startedAt: customTimestamptz("started_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  finishedAt: customTimestamptz("finished_at", { precision: 6 }).default(sql`CURRENT_TIMESTAMP`),
  status: varchar("status", { length: 20 }).notNull().default('finished'),
  currentIndex: integer("current_index").notNull().default(0),
  appUserId: uuid("app_user_id"),
  wrongBookSynced: boolean("wrong_book_synced").notNull().default(false),
  practiceMode: varchar("practice_mode", { length: 20 }).notNull().default('basic'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE INDEX idx_practice_record_user_id ON practice_record USING btree (((user_id).user_id)),
  index("idx_practice_record_finished_at").on(table.finishedAt),
  // Complex index: CREATE INDEX idx_practice_record_user_status ON practice_record USING btree (((user_id).user_id), status),
  index("idx_practice_record_app_user").on(table.appUserId),
  index("idx_practice_record_mode").on(table.practiceMode),
  index("idx_practice_record_bank_id").on(table.bankId),
  foreignKey({
    columns: [table.bankId],
    foreignColumns: [questionBank.id],
    name: "practice_record_bank_id_fkey",
  }).onDelete("cascade"),
]);

export const question = pgTable("question", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankId: uuid("bank_id").notNull(),
  content: text("content").notNull(),
  questionType: varchar("question_type", { length: 20 }).notNull().default('single'),
  /**
   * @type { label: string; text: string; }[]
   */
  options: jsonb("options").notNull().default('[]'),
  /**
   * @type number[]
   */
  correctAnswers: jsonb("correct_answers").notNull().default('[]'),
  analysis: text("analysis").notNull(),
  appUserId: uuid("app_user_id"),
  /**
   * @type { content: string; correctAnswer: string; analysis: string }[]
   */
  subQuestions: jsonb("sub_questions").notNull().default('[]'),
  knowledgePoints: text("knowledge_points").notNull(),
  unitName: varchar("unit_name", { length: 100 }),
  sortOrder: integer("sort_order").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_question_bank_id").on(table.bankId),
  index("idx_question_app_user").on(table.appUserId),
  foreignKey({
    columns: [table.bankId],
    foreignColumns: [questionBank.id],
    name: "question_bank_id_fkey",
  }).onDelete("cascade"),
]);

export const questionBank = pgTable("question_bank", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  questionCount: integer("question_count").notNull().default(0),
  isTemporary: boolean("is_temporary").notNull().default(false),
  bankType: varchar("bank_type", { length: 20 }).notNull().default('normal'),
  ownerUserId: userProfile("owner_user_id"),
  subjectId: uuid("subject_id"),
  appUserId: uuid("app_user_id"),
  isPublic: boolean("is_public").notNull().default(false),
  lastPracticedAt: customTimestamptz("last_practiced_at", { precision: 3 }),
  avgRating: numeric("avg_rating").default('0'),
  ratingCount: integer("rating_count").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_question_bank_created_at").on(table.createdAt),
  index("idx_question_bank_is_temporary").on(table.isTemporary),
  index("idx_question_bank_type").on(table.bankType),
  // Complex index: CREATE INDEX idx_question_bank_owner ON question_bank USING btree (((owner_user_id).user_id)),
  index("idx_question_bank_subject_id").on(table.subjectId),
  index("idx_question_bank_app_user").on(table.appUserId),
  index("idx_question_bank_is_public").on(table.isPublic),
  foreignKey({
    columns: [table.subjectId],
    foreignColumns: [subject.id],
    name: "question_bank_subject_id_fkey",
  }).onDelete("set null"),
]);

// table aliases
export const adminOperationLogTable = adminOperationLog;
export const appUserTable = appUser;
export const checkinSettingTable = checkinSetting;
export const clientApiPerfTable = clientApiPerf;
export const clientErrorLogTable = clientErrorLog;
export const clientPerfLogTable = clientPerfLog;
export const dailyAnswerRecordTable = dailyAnswerRecord;
export const favoriteGroupTable = favoriteGroup;
export const favoriteGroupItemTable = favoriteGroupItem;
export const practiceAnswerTable = practiceAnswer;
export const practiceRecordTable = practiceRecord;
export const questionTable = question;
export const questionBankTable = questionBank;
export const questionBankCollaboratorTable = questionBankCollaborator;
export const questionBankEditRequestTable = questionBankEditRequest;
export const questionBankRatingTable = questionBankRating;
export const questionBankVersionTable = questionBankVersion;
export const questionCommentTable = questionComment;
export const questionFeedbackTable = questionFeedback;
export const questionTagTable = questionTag;
export const questionTagRelTable = questionTagRel;
export const subjectTable = subject;
export const systemLogTable = systemLog;
export const userDeviceTable = userDevice;
export const userQuestionStateTable = userQuestionState;
export const userSettingsTable = userSettings;
export const userSyncStateTable = userSyncState;
