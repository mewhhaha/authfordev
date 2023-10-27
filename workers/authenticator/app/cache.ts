export const createCacheHeaders = (request: Request) => {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 3); // 3rd of next month
  const expireDate = nextMonth.toUTCString();

  const staleAge = Math.floor((nextMonth.getTime() - now.getTime()) / 1000); // Until next month when revalidation attempt happens
  const maxAge = 31536000; // A year

  const headers = {
    "Cache-Control": `public, max-age=${maxAge} stale-while-revalidate=${staleAge}`,
    Expires: expireDate,
    "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "",
    "Access-Control-Allow-Method": "GET",
  };

  return headers;
};
