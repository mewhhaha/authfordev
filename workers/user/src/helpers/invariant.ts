export function invariant<T>(
  condition: T,
  expected: string
): asserts condition {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!condition) {
    console.error(expected);
    throw new Error(expected);
  }
}
