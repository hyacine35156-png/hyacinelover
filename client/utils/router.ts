import {
  useNavigate as useReactNavigate,
  Link as ReactLink,
  NavLink as ReactNavLink,
  type NavigateFunction,
  type To,
} from 'react-router-dom';
import React, { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';

declare global {
  interface Window {
    __BASENAME__?: string;
  }
}

let cachedPrefix: string | null = null;

function pathSegmentsEqualOrParent(parent: string, child: string): boolean {
  const parentSegs = parent.split('/').filter(Boolean);
  const childSegs = child.split('/').filter(Boolean);
  if (parentSegs.length > childSegs.length) return false;
  for (let i = 0; i < parentSegs.length; i++) {
    if (parentSegs[i] !== childSegs[i]) return false;
  }
  return true;
}

export function getUrlPrefix(): string {
  if (cachedPrefix !== null) return cachedPrefix;

  let detectedFromUrl = '';
  try {
    const pathname = window.location.pathname;
    const match = pathname.match(/^(\/app\/[^/]+)/);
    if (match && match[1] !== '/app') {
      detectedFromUrl = match[1];
    }
  } catch {
    // ignore
  }

  const envBase = (import.meta as unknown as { env?: Record<string, string> }).env
    ?.CLIENT_BASE_PATH;
  const windowBasename = typeof window !== 'undefined'
    ? (window as { __BASENAME__?: string }).__BASENAME__
    : undefined;

  logger.info('[Router] URL前缀检测', {
    pathname: typeof window !== 'undefined' ? window.location.pathname : 'N/A',
    envBase,
    detectedFromUrl,
    windowBasename,
  });

  if (
    windowBasename &&
    windowBasename !== '/'
  ) {
    const normalized = windowBasename.replace(/\/$/, '');
    if (!detectedFromUrl || pathSegmentsEqualOrParent(normalized, detectedFromUrl)) {
      cachedPrefix = '';
      logger.info('[Router] 使用 window.__BASENAME__ 作为基准，无前缀补偿', { normalized });
      return cachedPrefix;
    }
  }

  if (envBase && envBase !== '/' && envBase !== '' && !windowBasename) {
    const normalized = envBase.replace(/\/$/, '');
    if (!detectedFromUrl || pathSegmentsEqualOrParent(normalized, detectedFromUrl)) {
      cachedPrefix = '';
      logger.info('[Router] 使用环境变量 CLIENT_BASE_PATH 作为基准，无前缀补偿', { normalized });
      return cachedPrefix;
    }
  }

  cachedPrefix = detectedFromUrl;
  logger.info('[Router] 检测到URL前缀', { prefix: cachedPrefix });
  return cachedPrefix;
}

export function withPrefix(to: To): To {
  const prefix = getUrlPrefix();
  if (!prefix) return to;

  if (typeof to === 'string') {
    if (to.startsWith(prefix)) return to;
    if (to.startsWith('/')) return `${prefix}${to}`;
    return to;
  }

  return {
    ...to,
    pathname: to.pathname
      ? (to.pathname.startsWith(prefix)
          ? to.pathname
          : to.pathname.startsWith('/')
            ? `${prefix}${to.pathname}`
            : to.pathname)
      : to.pathname,
  };
}

export function useNavigate(): NavigateFunction {
  const navigate = useReactNavigate();

  return ((to: unknown, options?: unknown) => {
    if (typeof to === 'number') {
      navigate(to as number);
      return;
    }
    navigate(withPrefix(to as To), options as never);
  }) as NavigateFunction;
}

interface LinkProps extends Omit<ComponentPropsWithoutRef<typeof ReactLink>, 'to'> {
  to: To;
  children: ReactNode;
}

export function Link(props: LinkProps) {
  const { to, children, ...rest } = props;
  return React.createElement(ReactLink, { to: withPrefix(to), ...rest }, children);
}

interface NavLinkProps extends Omit<ComponentPropsWithoutRef<typeof ReactNavLink>, 'children'> {
  children?: ReactNode | (({ isActive, isPending, }: { isActive: boolean; isPending: boolean }) => ReactNode);
}

export function NavLink(props: NavLinkProps) {
  const { to, children, ...rest } = props;
  return React.createElement(ReactNavLink, { to: withPrefix(to), ...rest, children: children as never });
}

export { resolvePath, navigateTo } from './env';
