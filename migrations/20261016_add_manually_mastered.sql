-- L-3 掌握语义不一致修复：添加 manually_mastered 字段
-- 执行时间：2026-10-16
-- 说明：区分用户手动标记的掌握与系统自动判定的掌握，答错时不重置用户手动标记

ALTER TABLE user_question_state
ADD COLUMN IF NOT EXISTS manually_mastered BOOLEAN NOT NULL DEFAULT FALSE;

-- 索引：可选，用于快速筛选用户手动标记的题目
-- CREATE INDEX IF NOT EXISTS idx_user_question_state_manually_mastered
--   ON user_question_state (app_user_id) WHERE manually_mastered = true;
