export function formatAddress(address = ''): string {
  return address.length > 16
    ? `${address.slice(0, 10)}...${address.slice(-4)}`
    : address;
}
