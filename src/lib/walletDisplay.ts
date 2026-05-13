export function shortPublicKey(base58: string, head = 4, tail = 4): string {
  if (base58.length <= head + tail) return base58
  return `${base58.slice(0, head)}…${base58.slice(-tail)}`
}
