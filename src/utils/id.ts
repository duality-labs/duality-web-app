function* generateAlmostUniqueId(id: number) {
  while (true) {
    id = id >= Number.MAX_SAFE_INTEGER ? 0 : id + 1;
    yield id;
  }
}
const idIterator = generateAlmostUniqueId(0);

export function generateId(): number {
  return idIterator.next().value || 0;
}
