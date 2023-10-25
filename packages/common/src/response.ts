import {
  type JSONResponse,
  type HttpStatus2XX,
  type HttpStatus4XX,
  type TextResponse,
} from "@mewhhaha/typed-response";

type Result<RESPONSE extends Response> = RESPONSE extends JSONResponse<
  infer C extends HttpStatus2XX,
  infer R
>
  ? RESPONSE extends JSONResponse<any, never> | TextResponse<any, infer T>
    ? {
        readonly success: true;
        readonly status: C;
        readonly result: T;
        readonly error?: undefined;
      }
    : {
        readonly success: true;
        readonly status: C;
        readonly result: R;
        readonly error?: undefined;
      }
  : RESPONSE extends JSONResponse<infer C extends HttpStatus4XX, infer E>
  ? {
      readonly success: false;
      readonly status: C;
      readonly result?: undefined;
      readonly error: E;
    }
  : never;

export const tryResult = async <RESPONSE extends Response>(
  r: RESPONSE
): Promise<Result<RESPONSE>> => {
  if (r.ok) {
    if (r.headers.get("Content-Type") === "application/json") {
      // @ts-expect-error Hard to type this
      return {
        success: true,
        status: r.status,
        result: await r.json(),
      };
    } else {
      // @ts-expect-error Hard to type this
      return {
        success: true,
        status: r.status,
        result: await r.text(),
      };
    }
  }

  if (r.headers.get("Content-Type") === "application/json") {
    // @ts-expect-error Hard to type this
    return {
      success: false,
      status: r.status,
      error: await r.json(),
    };
  }

  throw new Error(
    `Unexpected result: ${r.status} ${r.headers.get("Content-Type")}`
  );
};
