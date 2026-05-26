const API_V1_BASE =
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');

/** Host yang di-fetch lewat proxy backend (ImgBB, Cloudinary, dll.). */
const PROXYABLE_HOSTS = new Set([
  'i.ibb.co',
  'ibb.co',
  'image.ibb.co',
  'res.cloudinary.com',
]);

function apiOrigin(): string {
  return API_V1_BASE.replace(/\/api\/v1$/i, '');
}

function isProxyableHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (PROXYABLE_HOSTS.has(host)) return true;
  for (const allowed of PROXYABLE_HOSTS) {
    if (host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

/** URL sudah menunjuk ke endpoint proxy backend. */
export function isProxiedImageUrl(url: string): boolean {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined);
    return u.pathname.includes('/public/media/proxy') || u.pathname.includes('/media/proxy');
  } catch {
    return false;
  }
}

/** Perlu di-proxy (HTTPS eksternal di allowlist, bukan data URL / backend sendiri). */
export function needsImageProxy(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:') || isProxiedImageUrl(trimmed)) {
    return false;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:') return false;
    const apiHost = new URL(apiOrigin() || 'http://localhost:8080').hostname.toLowerCase();
    if (u.hostname.toLowerCase() === apiHost) return false;
    return isProxyableHost(u.hostname);
  } catch {
    return false;
  }
}

/** Ubah URL ImgBB/eksternal menjadi URL proxy backend untuk tag &lt;img&gt;. */
export function proxiedImageUrl(url: string): string {
  if (!needsImageProxy(url)) return url;
  const base = API_V1_BASE;
  return `${base}/public/media/proxy?url=${encodeURIComponent(url.trim())}`;
}
