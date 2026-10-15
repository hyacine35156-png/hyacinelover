/**
 * 基础测试示例
 * 后续可按模块拆分：auth.test.ts、practice-record.test.ts 等
 */
import { describe, it, expect } from 'vitest';

describe('基础测试', () => {
  it('应该能正常运行测试框架', () => {
    expect(1 + 1).toBe(2);
  });

  it('应该支持异步测试', async () => {
    const result = await Promise.resolve('hyacine');
    expect(result).toBe('hyacine');
  });
});
