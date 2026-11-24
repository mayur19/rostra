import { isIPv4, isIPv6 } from 'node:net';

const MAPPED_V4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

function expandIpv6(address: string): string[] {
  const [head = '', tail = ''] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = address.includes('::') && tail ? tail.split(':') : [];
  const missing = 8 - left.length - right.length;
  const groups = address.includes('::')
    ? [...left, ...Array<string>(missing).fill('0'), ...right]
    : left;
  return groups.map((g) => g.toLowerCase().replace(/^0+(?=.)/, ''));
}

/**
 * Normalises a client address into a throttling key. IPv4-mapped IPv6 becomes plain
 * IPv4; any other IPv6 address collapses to its /64 prefix, since a single subscriber
 * typically controls a whole /64 and could otherwise rotate addresses freely.
 */
export function ipKey(raw: string | null | undefined): string {
  const address = (raw ?? '').trim().replace(/%.*$/, '');
  const mapped = MAPPED_V4.exec(address);
  if (mapped?.[1] && isIPv4(mapped[1])) return mapped[1];
  if (isIPv4(address)) return address;
  if (isIPv6(address)) return `${expandIpv6(address).slice(0, 4).join(':')}::/64`;
  return 'unknown';
}
