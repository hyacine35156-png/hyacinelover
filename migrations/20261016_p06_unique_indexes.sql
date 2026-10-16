-- P0-6: 补齐数据库唯一约束与索引
-- 此迁移为幂等设计，使用 IF NOT EXISTS 确保可重复执行
-- 执行时间: 2026-10-16

-- 1. 题库评分：每个用户对每个题库只能评分一次
CREATE UNIQUE INDEX IF NOT EXISTS idx_qb_rating_bank_user
ON question_bank_rating (bank_id, app_user_id);

-- 2. 题库版本：每个题库版本号唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_qb_version_bank_num
ON question_bank_version (bank_id, version_number);

-- 3. 题库协作者：每个用户在每个题库只能有一个协作者记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_qb_collaborator_bank_user
ON question_bank_collaborator (bank_id, app_user_id);

-- 4. 收藏分组题目：每个分组内同一题目只能收藏一次
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorite_group_item_gq
ON favorite_group_item (group_id, question_id);

-- 5. 用户同步状态：每个用户只有一条同步状态记录
CREATE UNIQUE INDEX IF NOT EXISTS user_sync_state_user_id_key
ON user_sync_state (user_id);

-- 6. 用户设置：每个用户只有一条设置记录
CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_id_key
ON user_settings (user_id);

-- 7. 用户设备：每个用户的每台设备只能有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_device_user_device
ON user_device (user_id, device_id);

-- 8. 每日答题记录：每个用户每天每道题只能有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS daily_answer_record_user_id_answer_date_question_id_key
ON daily_answer_record (user_id, answer_date, question_id);

-- 9. 打卡设置：每个用户只有一条打卡设置
CREATE UNIQUE INDEX IF NOT EXISTS checkin_setting_user_id_key
ON checkin_setting (user_id);

-- 10. 用户表：用户名唯一
CREATE UNIQUE INDEX IF NOT EXISTS app_user_username_key
ON app_user (username);

-- 11. 用户表：UID唯一
CREATE UNIQUE INDEX IF NOT EXISTS app_user_uid_idx
ON app_user (uid);

-- 12. 题目标签关联：每个题目与标签的关联唯一
CREATE UNIQUE INDEX IF NOT EXISTS question_tag_rel_question_tag_idx
ON question_tag_rel (question_id, tag_id);

-- 13. 用户题目状态：每个用户对每道题只有一条状态记录
CREATE UNIQUE INDEX IF NOT EXISTS user_question_state_user_id_question_id_key
ON user_question_state (user_id, question_id);

-- 14. 练习答题记录：每条练习记录中每道题只能有一条答题记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_answer_record_question
ON practice_answer (record_id, question_id);
