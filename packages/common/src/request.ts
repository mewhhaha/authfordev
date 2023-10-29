import { type JSONString } from "@mewhhaha/json-string";

type ExtractCaseInsensitive<
  T extends Record<string, string>,
  Y extends string,
> = {
  [KEY in Extract<keyof T, string>]: Lowercase<KEY> extends Lowercase<Y>
    ? KEY
    : never;
}[Extract<keyof T, string>];

export const initJSON = <T, Y extends Record<string, string> = {}>(
  body: T,
  headers: "content-type" extends Lowercase<Extract<keyof Y, string>>
    ? Omit<Y, ExtractCaseInsensitive<Y, "content-type">> & {
        [KEY in ExtractCaseInsensitive<Y, "content-type">]: "application/json";
      }
    : Y = {} as typeof headers
): {
  headers: { "Content-Type": "application/json" } & typeof headers;
  body: JSONString<T>;
} => {
  return {
    headers: {
      "Content-Type": "application/json" as const,
      ...(headers || ({} as typeof headers)),
    },
    body: JSON.stringify(body),
  };
};
