// an expected wallet address, eg. cosmos1ywtansy6ss0jtq8ckrcv6jzkps8yh8mfc8xucq
export type WalletAddress = string;

export function formatAddress(address = ''): string {
  return address.length > 16
    ? `${address.slice(0, 10)}...${address.slice(-4)}`
    : address;
}
