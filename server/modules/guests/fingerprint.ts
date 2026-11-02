import { createHmac } from 'node:crypto';
import { readUserAgent } from '../analytics/userAgent.ts';

/**
 * A keyed hash of the network and the kind of device (D-083): the same person on the same
 * device matches after clearing cookies or opening a private window, but the raw address is
 * never stored and the hash means nothing without the server's secret.
 */

/** IPv4 as is; IPv6 cut to its /64 (phones rotate the rest for privacy). */
export function networkOf(ip: string): string {
  const v4 = /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (v4) return v4[1];
  const groups = ip.toLowerCase().split('::')[0].split(':').filter(Boolean);
  return groups.length > 0 ? `${groups.slice(0, 4).join(':')}::/64` : ip;
}

export function fingerprint(secret: string, ip: string, userAgent: string | undefined): string {
  const c = readUserAgent(userAgent);
  return createHmac('sha256', secret).update(`${networkOf(ip)}|${c.device}|${c.os}|${c.browser}`).digest('base64url');
}
