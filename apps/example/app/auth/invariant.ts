export function invariant<T>(
  condition: T,
  expected: string
): asserts condition {
  if (!condition) {
    console.error(expected);
    throw new Error(expected);
  }
}
