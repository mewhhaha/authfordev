import { type JSONString } from "@mewhhaha/json-string";

type JSONBody = {
  <T>(
    body: T,
    authorization?: undefined
  ): {
    headers: { "Content-Type": "application/json" };
    body: JSONString<T>;
  };
  <T, Y extends string>(
    body: T,
    authorization: Y
  ): {
    headers: { "Content-Type": "application/json"; Authorization: Y };
    body: JSONString<T>;
  };
};

export const jsonBody: JSONBody = <T, Y extends string>(
  body: T,
  authorization?: Y
) => {
  return {
    headers: {
      "Content-Type": "application/json" as const,
      Authorization: authorization,
    },
    body: JSON.stringify(body),
  };
};
