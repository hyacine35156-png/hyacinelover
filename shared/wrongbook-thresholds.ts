/**
 * 错题本/智能推荐统一判定阈值
 * 所有"重点错题"/"高频错题"判定必须使用本文件常量，禁止硬编码
 */

// 重点错题判定条件（三者同时满足）：
// 1. 未掌握 (mastered = false)
// 2. 作答次数 >= MIN_ATTEMPT_COUNT
// 3. 错误次数 >= MIN_WRONG_COUNT，或错误率 > MAX_WRONG_RATIO
export const WRONGBOOK_MIN_ATTEMPT_COUNT = 2;
export const WRONGBOOK_MIN_WRONG_COUNT = 2;
export const WRONGBOOK_MAX_WRONG_RATIO = 0.5;

/**
 * 判断一道题是否为"重点错题"（与错题本SQL查询逻辑一致）
 */
export function isKeyWrongQuestion(params: {
  mastered: boolean;
  attemptCount: number;
  wrongCount: number;
}): boolean {
  const { mastered, attemptCount, wrongCount } = params;
  if (mastered) return false;
  if (attemptCount < WRONGBOOK_MIN_ATTEMPT_COUNT) return false;
  const wrongRatio = attemptCount > 0 ? wrongCount / attemptCount : 0;
  return wrongCount >= WRONGBOOK_MIN_WRONG_COUNT || wrongRatio > WRONGBOOK_MAX_WRONG_RATIO;
}
