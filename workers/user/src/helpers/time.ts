export const now = () => new Date().toISOString() as DateISOString;

export type DateISOString =
  `${string}-${string}-${string}T${string}:${string}:${string}.${string}Z`;

export const minute1 = () => fromNow(1000 * 60);

export const fromNow = (ms: number) => {
  return new Date(new Date().getTime() + ms);
};
