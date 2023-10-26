import { type TaggedType } from "@internal/common";

export const now = () => new Date().toISOString() as DateISOString;

export type DateISOString = TaggedType<string, "date_iso_string">;

export const minute1 = () => fromNow(1000 * 60);

export const fromNow = (ms: number) => {
  return new Date(new Date().getTime() + ms);
};
