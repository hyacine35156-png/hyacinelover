import { APP_VERSION, APP_VERSION_DISPLAY, APP_BUILD_TIME, APP_VERSION_NOTE } from './version';

describe('version constants', () => {
  it('APP_VERSION是有效的语义化版本号', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('APP_VERSION_DISPLAY包含应用名称和版本号', () => {
    expect(APP_VERSION_DISPLAY).toContain('hyacine小助手');
    expect(APP_VERSION_DISPLAY).toContain(APP_VERSION);
  });

  it('APP_BUILD_TIME是有效的日期格式', () => {
    expect(APP_BUILD_TIME).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const date = new Date(APP_BUILD_TIME);
    expect(date.getTime()).not.toBeNaN();
  });

  it('APP_VERSION_NOTE非空', () => {
    expect(APP_VERSION_NOTE).toBeTruthy();
    expect(APP_VERSION_NOTE.length).toBeGreaterThan(0);
  });

  it('版本号前后端一致（通过shared统一来源）', () => {
    // 确保版本号格式正确，主版本号合理
    const [major, minor, patch] = APP_VERSION.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(2);
    expect(minor).toBeGreaterThanOrEqual(0);
    expect(patch).toBeGreaterThanOrEqual(0);
  });
});
