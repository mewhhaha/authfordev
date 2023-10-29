const __DEV__: Record<string, string> = {};

export function invariant<T>(
  condition: T,
  expected: string
): asserts condition {
  if (__DEV__.STRIP_INVARIANT_MESSAGE) {
  }

  if (!condition) {
    const message = __DEV__.STRIP_INVARIANT_MESSAGE
      ? "Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings."
      : expected;

    const error = new Error(message);
    error.name = "Invariant Violation";
    throw error;
  }
}
