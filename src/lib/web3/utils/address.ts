// an expected wallet address, eg. cosmos1ywtansy6ss0jtq8ckrcv6jzkps8yh8mfc8xucq
export type WalletAddress = string;

export function formatAddress(
  address = '',
  maxLength = 15,
  prefixLength = 6
): string {
  const endLength = Math.ceil((maxLength - 1 - prefixLength) / 2);
  return address.length > maxLength
    ? `${address.slice(0, maxLength - endLength - 1)}…${address.slice(
        -endLength
      )}`
    : address;
}
