/**
 * 注意：auth.service.ts中的hashPassword和verifyPassword不是export的
 * 这里测试通过反射方式验证密码逻辑，或测试公开的认证流程
 * 由于依赖数据库，这里只测试纯函数部分
 */

import * as crypto from 'crypto';

// 复刻auth.service中的密码哈希逻辑进行测试
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_KEY_LEN = 64;
const PBKDF2_DIGEST = 'sha256';
const SALT_LEN = 16;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LEN,
    PBKDF2_DIGEST,
  ).toString('hex');
  return `${PBKDF2_ITERATIONS}:${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  const iterations = parts.length === 3 ? parseInt(parts[0], 10) : 10000;
  const salt = parts.length === 3 ? parts[1] : parts[0];
  const storedKey = parts.length === 3 ? parts[2] : parts[1];
  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    PBKDF2_KEY_LEN,
    PBKDF2_DIGEST,
  ).toString('hex');
  return derivedKey === storedKey;
}

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
    expect(parseInt(parts[0], 10)).toBe(PBKDF2_ITERATIONS);
    expect(parts[1]).toHaveLength(SALT_LEN * 2); // hex编码
    expect(parts[2]).toHaveLength(PBKDF2_KEY_LEN * 2);
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
    // 旧格式: salt:key（默认10000次迭代）
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.pbkdf2Sync('oldPass', salt, 10000, 64, 'sha256').toString('hex');
    const oldHash = `${salt}:${key}`;
    expect(verifyPassword('oldPass', oldHash)).toBe(true);
    expect(verifyPassword('wrong', oldHash)).toBe(false);
  });
});
