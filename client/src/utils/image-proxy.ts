import { resolvePath } from './env';

const CORS_HOSTS = [
  'aka.doubaocdn.com',
  'lf3-static.bytednsdoc.com',
];

export function isCorsImage(url: string): boolean {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return false;
  try {
    const u = new URL(url);
    return CORS_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

export function toProxyImage(url: string): string {
  if (!isCorsImage(url)) return url;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname.replace(/^\//, '');
    const query = u.search.replace(/^\?/, '');
    const proxyPath = `/img-proxy/${host}/${path}${query ? '?' + query : ''}`;
    return resolvePath(proxyPath);
  } catch {
    return url;
  }
}
