const CLIENT_IP_HEADER = "CF-Connecting-IP";
const UNKNOWN_CLIENT_KEY = "unknown";

/**
 * Cloudflare sets CF-Connecting-IP on every edge request; it's absent only in local dev,
 * where all traffic shares one rate-limit bucket under the fallback key.
 */
export function clientIpFromRequest(request: Request): string {
  return request.headers.get(CLIENT_IP_HEADER) ?? UNKNOWN_CLIENT_KEY;
}
