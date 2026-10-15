export type ErrorCategory =
  | 'network'
  | 'render'
  | 'data'
  | 'permission'
  | 'timeout'
  | 'validation'
  | 'unknown';

export interface ErrorInfo {
  category: ErrorCategory;
  message: string;
  status?: number;
  code?: string;
  details?: string;
}

const ERROR_MESSAGES: Record<ErrorCategory, { title: string; description: string; suggestion: string }> = {
  network: {
    title: '网络连接异常',
    description: '无法连接到服务器，请检查网络是否正常',
    suggestion: '请检查网络连接后刷新页面重试',
  },
  timeout: {
    title: '请求超时',
    description: '服务器响应时间过长',
    suggestion: '请检查网络后重试，或稍后再试',
  },
  permission: {
    title: '权限不足',
    description: '您没有访问该资源的权限或登录已过期',
    suggestion: '请重新登录后继续操作',
  },
  validation: {
    title: '参数校验失败',
    description: '提交的数据格式不正确',
    suggestion: '请检查输入内容后重新提交',
  },
  data: {
    title: '数据格式异常',
    description: '返回的数据格式与预期不符',
    suggestion: '请刷新页面重试，如问题持续请联系管理员',
  },
  render: {
    title: '页面渲染异常',
    description: '页面渲染过程中出现错误',
    suggestion: '请刷新页面试试，如问题持续请清除浏览器缓存',
  },
  unknown: {
    title: '发生未知错误',
    description: '系统遇到了意料之外的问题',
    suggestion: '请刷新页面重试，如问题持续请联系管理员',
  },
};

export function getErrorMeta(category: ErrorCategory) {
  return ERROR_MESSAGES[category] ?? ERROR_MESSAGES.unknown;
}

export function getHttpStatus(error: unknown): number | undefined {
  if (error == null || typeof error !== 'object') return undefined;
  const anyErr = error as Record<string, unknown>;
  const status = anyErr.status;
  if (typeof status === 'number') return status;
  const response = anyErr.response;
  if (response && typeof response === 'object') {
    const s = (response as Record<string, unknown>).status;
    if (typeof s === 'number') return s;
  }
  return undefined;
}

export function getErrorCode(error: unknown): string | undefined {
  if (error == null || typeof error !== 'object') return undefined;
  const anyErr = error as Record<string, unknown>;
  const code = anyErr.code;
  if (typeof code === 'string') return code;
  const data = anyErr.response && typeof anyErr.response === 'object'
    ? (anyErr.response as Record<string, unknown>).data
    : undefined;
  if (data && typeof data === 'object') {
    const err = (data as Record<string, unknown>).error;
    if (err && typeof err === 'object') {
      const c = (err as Record<string, unknown>).code;
      if (typeof c === 'string') return c;
    }
  }
  return undefined;
}

export function classifyError(error: unknown): ErrorInfo {
  const message = extractErrorMessage(error);
  const status = getHttpStatus(error);
  const code = getErrorCode(error);
  const anyErr = error as Record<string, unknown> | null;

  if (code === 'ECONNABORTED' || message.includes('timeout') || message.includes('超时')) {
    return { category: 'timeout', message, status, code };
  }

  const errStr = String(error ?? '');
  if (
    errStr.includes('NetworkError') ||
    errStr.includes('Failed to fetch') ||
    errStr.includes('Network Error') ||
    code === 'ERR_NETWORK' ||
    (anyErr && anyErr.isAxiosError && status === undefined)
  ) {
    return { category: 'network', message, status, code };
  }

  if (status === 401 || status === 403) {
    return { category: 'permission', message, status, code };
  }
  if (status === 400 || status === 422 || status === 409) {
    return { category: 'validation', message, status, code };
  }
  if (status && status >= 500) {
    return { category: 'network', message, status, code };
  }

  if (message.includes('JSON') || message.includes('格式') || message.includes('format')) {
    return { category: 'data', message, status, code };
  }

  if (error instanceof TypeError && (message.includes('null') || message.includes('undefined'))) {
    return { category: 'render', message, status, code };
  }

  return { category: 'unknown', message, status, code };
}

export function extractErrorMessage(error: unknown): string {
  if (error == null) return '未知错误';
  if (typeof error === 'string') return error;

  const anyErr = error as Record<string, unknown>;

  const data = anyErr.response && typeof anyErr.response === 'object'
    ? (anyErr.response as Record<string, unknown>).data
    : undefined;

  if (data && typeof data === 'object') {
    const msg = extractFromErrorPayload(data as Record<string, unknown>);
    if (msg) return msg;
  }

  const topMsg = extractFromErrorPayload(anyErr);
  if (topMsg) return topMsg;

  if (error instanceof Error && error.message) return error.message;

  const msg = anyErr.message;
  if (typeof msg === 'string' && msg) return msg;

  return '未知错误';
}

function extractFromErrorPayload(obj: Record<string, unknown>): string | null {
  const err = obj.error;
  if (err && typeof err === 'object') {
    const errObj = err as Record<string, unknown>;
    const m = errObj.message;
    if (typeof m === 'string' && m) return m;
    if (m && typeof m === 'object') {
      const inner = (m as Record<string, unknown>).message;
      if (typeof inner === 'string' && inner) return inner;
    }
    const d = errObj.details;
    if (typeof d === 'string' && d) {
      try {
        const parsed = JSON.parse(d);
        if (parsed && typeof parsed === 'object' && typeof parsed.message === 'string') {
          return parsed.message;
        }
      } catch {
        // ignore
      }
    }
  }
  const directMsg = obj.message;
  if (typeof directMsg === 'string' && directMsg) return directMsg;
  return null;
}
