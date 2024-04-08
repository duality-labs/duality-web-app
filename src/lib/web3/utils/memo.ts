const { REACT_APP__APP_VERSION = '' } = import.meta.env;

export function createMemo(message?: string): string {
  const memo: Record<string, string> = {
    app: `${location.origin}${location.pathname}`,
    version: REACT_APP__APP_VERSION,
  };
  if (message) {
    memo.message = message;
  }
  return JSON.stringify(memo);
}
