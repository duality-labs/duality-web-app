import { logs } from '@cosmjs/stargate';

// safely return response events from a rawLog if found
// rawLog can be found as a property on some DeliverTxResponse objects
export function readEvents(rawLog = '[]'): logs.Log['events'] | undefined {
  let logs: logs.Log[];
  try {
    logs = JSON.parse(rawLog || '[]');
  } catch {
    return undefined;
  }
  // return events from logs
  return logs?.flatMap((log: logs.Log) => log.events);
}
