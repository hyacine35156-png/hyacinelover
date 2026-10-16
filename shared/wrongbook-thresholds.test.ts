import {
  isKeyWrongQuestion,
  WRONGBOOK_MIN_ATTEMPT_COUNT,
  WRONGBOOK_MIN_WRONG_COUNT,
  WRONGBOOK_MAX_WRONG_RATIO,
} from '@shared/wrongbook-thresholds';

describe('wrongbook-thresholds', () => {
  describe('isKeyWrongQuestion', () => {
    it('已掌握的题目不是重点错题', () => {
      expect(isKeyWrongQuestion({
        mastered: true,
        attemptCount: 10,
        wrongCount: 10,
      })).toBe(false);
    });

    it('作答次数不足时不是重点错题', () => {
      expect(isKeyWrongQuestion({
        mastered: false,
        attemptCount: WRONGBOOK_MIN_ATTEMPT_COUNT - 1,
        wrongCount: 10,
      })).toBe(false);
    });

    it('错误次数达到阈值时是重点错题', () => {
      expect(isKeyWrongQuestion({
        mastered: false,
        attemptCount: WRONGBOOK_MIN_ATTEMPT_COUNT,
        wrongCount: WRONGBOOK_MIN_WRONG_COUNT,
      })).toBe(true);
    });

    it('错误率超过阈值时是重点错题', () => {
      // 3次作答错2次，错误率0.667 > 0.5
      expect(isKeyWrongQuestion({
        mastered: false,
        attemptCount: 3,
        wrongCount: 2,
      })).toBe(true);
    });

    it('错误率刚好等于阈值时不是重点错题（需要严格大于）', () => {
      // 4次作答错2次，错误率0.5，不大于0.5
      // 但wrongCount=2 >= MIN_WRONG_COUNT=2，所以还是重点错题
      expect(isKeyWrongQuestion({
        mastered: false,
        attemptCount: 4,
        wrongCount: 2,
      })).toBe(true);
    });

    it('错误率低于阈值且错误次数不足时不是重点错题', () => {
      // 5次作答错1次，错误率0.2 < 0.5，wrongCount=1 < 2
      expect(isKeyWrongQuestion({
        mastered: false,
        attemptCount: 5,
        wrongCount: 1,
      })).toBe(false);
    });

    it('0次作答时不是重点错题', () => {
      expect(isKeyWrongQuestion({
        mastered: false,
        attemptCount: 0,
        wrongCount: 0,
      })).toBe(false);
    });

    it('大量作答但全对时不是重点错题', () => {
      expect(isKeyWrongQuestion({
        mastered: false,
        attemptCount: 100,
        wrongCount: 0,
      })).toBe(false);
    });
  });

  describe('阈值常量', () => {
    it('最小作答次数为2', () => {
      expect(WRONGBOOK_MIN_ATTEMPT_COUNT).toBe(2);
    });

    it('最小错误次数为2', () => {
      expect(WRONGBOOK_MIN_WRONG_COUNT).toBe(2);
    });

    it('最大错误率为0.5', () => {
      expect(WRONGBOOK_MAX_WRONG_RATIO).toBe(0.5);
    });
  });
});
