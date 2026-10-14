const ENDPOINT = "https://graphql.anilist.co";

export class AlError extends Error {
  status?: number;
  retryAfter?: number;

  constructor(message: string, status?: number, retryAfter?: number) {
    super(message);
    this.name = "AlError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export async function alFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string | null,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new AlError("Couldn't reach AniList — check your internet connection.");
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "60") || 60;
    throw new AlError("AniList rate limit reached — pausing for a moment.", 429, retryAfter);
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: T; errors?: { message?: string }[] }
    | null;

  if (res.status === 401) {
    throw new AlError("Your AniList session expired. Please log in again.", 401);
  }
  if (!res.ok || json?.errors?.length) {
    const message = json?.errors?.[0]?.message ?? `AniList request failed (${res.status}).`;
    // AniList reports expired/invalid bearer tokens as HTTP 400 + "Invalid token".
    if (/invalid token|unauthorized|authentication/i.test(message)) {
      throw new AlError("Your AniList session expired. Please log in again.", 401);
    }
    throw new AlError(message, res.status);
  }
  if (!json?.data) {
    throw new AlError("AniList returned an unexpected response.");
  }
  return json.data;
}
