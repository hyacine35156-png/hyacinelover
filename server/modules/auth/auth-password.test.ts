/**
 * 密码哈希与验证测试
 * 直接引用生产代码 auth.service.ts 中的 hashPassword 和 verifyPassword
 * 断言使用独立字面量期望值，避免与生产常量同义反复（tautology）
 */
import { hashPassword, verifyPassword } from './auth.service';
import * as crypto from 'crypto';

describe('auth password hashing', () => {
  it('相同密码每次哈希结果不同（随机盐）', () => {
    const hash1 = hashPassword('testPassword123');
    const hash2 = hashPassword('testPassword123');
    expect(hash1).not.toBe(hash2);
  });

  it('正确密码验证通过', () => {
    const hash = hashPassword('mySecurePass!@#');
    expect(verifyPassword('mySecurePass!@#', hash)).toBe(true);
  });

  it('错误密码验证失败', () => {
    const hash = hashPassword('correctPassword');
    expect(verifyPassword('wrongPassword', hash)).toBe(false);
  });

  it('空密码可以正常哈希和验证', () => {
    const hash = hashPassword('');
    expect(verifyPassword('', hash)).toBe(true);
    expect(verifyPassword('notEmpty', hash)).toBe(false);
  });

  it('哈希格式包含迭代次数:盐:密钥三部分', () => {
    const hash = hashPassword('test');
    const parts = hash.split(':');
    expect(parts).toHaveLength(3);
    // 使用独立字面量期望值，不引用生产常量，避免同义反复
    expect(parseInt(parts[0], 10)).toBe(600_000); // OWASP 2023 推荐迭代次数
    expect(parts[1]).toHaveLength(32); // 16字节salt的hex长度
    expect(parts[2]).toHaveLength(128); // 64字节key的hex长度
  });

  it('特殊字符密码正常处理', () => {
    const specialPass = '密码🔒特殊!@#$%^&*()_+';
    const hash = hashPassword(specialPass);
    expect(verifyPassword(specialPass, hash)).toBe(true);
  });

  it('长密码（100字符）正常处理', () => {
    const longPass = 'a'.repeat(100);
    const hash = hashPassword(longPass);
    expect(verifyPassword(longPass, hash)).toBe(true);
  });

  it('兼容旧格式（无迭代次数前缀）', () => {
    // 旧格式: salt:key（默认10000次迭代，sha256）
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.pbkdf2Sync('oldPass', salt, 10000, 64, 'sha256').toString('hex');
    const oldHash = `${salt}:${key}`;
    expect(verifyPassword('oldPass', oldHash)).toBe(true);
    expect(verifyPassword('wrong', oldHash)).toBe(false);
  });
});
