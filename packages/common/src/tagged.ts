export type TaggedType<T, Z extends string> = Tag<Z> & T;

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface Tag<T> {
  readonly __tag: T;
}
