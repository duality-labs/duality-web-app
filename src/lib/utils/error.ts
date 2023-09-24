// determine if an unknown type is an Error (common for a catch block)
const isError = (err: unknown): err is Error => {
  return (
    // return error from this frame
    err instanceof Error ||
    // or error from another frame
    // see: https://stackoverflow.com/questions/30469261/checking-for-typeof-error-in-js#61958148
    Object.prototype.toString.call(err) === '[object Error]'
  );
};

// ensure that an unknown error can be handled as an error
export function coerceError(
  err: unknown,
  // you can pass a default error message or a message creator function
  // if the error message needs to be disambiguated
  messageOrCreateMessage:
    | string
    | ((err: unknown) => string) = createDefaultErrorMessage
): Error {
  // hopefully it is already an error
  if (isError(err)) {
    return err;
  }
  // if some dependency somewhere has thrown a non-error, attempt to handle it
  else {
    const errorMessage =
      typeof messageOrCreateMessage === 'function'
        ? // use custom error message creation
          messageOrCreateMessage(err)
        : // attempt to default parsing out error string for most types
          messageOrCreateMessage;
    return new Error(errorMessage);
  }
}

// default error message parsing attempts to convert known types to a string
function createDefaultErrorMessage(err: unknown): string {
  const objectType = Object.prototype.toString.call(err);
  switch (objectType) {
    case '[object Undefined]':
      return 'Unknown Error';
    case '[object Boolean]':
    case '[object Number]':
    case '[object String]':
      return `${err}`;
    case '[object Object]':
    case '[object Array]': {
      // lookup possible message attribute on an object or array
      // (yes it is possible to add a string key attribute to an array)
      const message = (err as { message?: string }).message;
      if (typeof message === 'string') {
        return message;
      }
      return JSON.stringify(err);
    }
    default:
      return `Unexpected ${objectType} Error`;
  }
}
