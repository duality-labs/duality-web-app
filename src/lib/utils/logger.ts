import Long from 'long';

const { REACT_APP__LOG_LEVEL = '' } = import.meta.env;

const levels = ['Verbose', 'Info', 'Warning', 'Error', 'None'] as const;
type Level = typeof levels[number];
type ConsoleMethod = Array<keyof Console>;
// mappings: https://developer.chrome.com/docs/devtools/console/api
const methods: Record<Level, ConsoleMethod> = {
  Verbose: ['debug'],
  Info: ['count', 'dir', 'dirxml', 'info', 'log', 'table', 'timeEnd', 'trace'],
  Warning: ['warn'],
  Error: ['assert', 'error'],
  None: [],
};
// pre-compute all silenced methods due to the logger
const silenced = Object.entries(methods).reduce<ConsoleMethod>(
  (acc, [level, methods]) => {
    if (levels.indexOf(level as Level) < levels.indexOf(REACT_APP__LOG_LEVEL)) {
      acc.push(...methods);
    }
    return acc;
  },
  []
);

// maybe create a logger that represents nested Long values as strings
const logger: Console | undefined = REACT_APP__LOG_LEVEL
  ? new Proxy(console, {
      // pass get calls
      get(target, name, receiver) {
        // define JSON replacer to convert Long objects to strings
        function replacer(_key: string, value: unknown) {
          // represent Long values as strings
          return Long.isLong(value) ? value.toString() : value;
        }
        // catch args as passed in
        return (...args: unknown[]) => {
          // get original method to be called and pass modified message
          const method = Reflect.get(target, name, receiver);
          return (
            !silenced.includes(name as keyof Console) &&
            method(
              // use JSON serialization to convert Long objects to strings
              ...args.map((v) => JSON.parse(JSON.stringify(v, replacer)))
            )
          );
        };
      },
      // pass set calls
      set(target, name, value, receiver) {
        return Reflect.set(target, name, value, receiver);
      },
    })
  : undefined;

// export the maybe logger
export default logger;
