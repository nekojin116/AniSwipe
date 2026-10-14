const TOKEN_KEY = "aniswipe.token";
const EXPIRY_KEY = "aniswipe.token_expires_at";

const CLIENT_ID = (import.meta.env.VITE_ANILIST_CLIENT_ID ?? "").trim();
const REDIRECT_URI = (import.meta.env.VITE_ANILIST_REDIRECT_URI ?? "").trim();

export function getClientId(): string {
  return CLIENT_ID;
}

export function hasClientConfig(): boolean {
  return CLIENT_ID.length > 0;
}

/** Must match the Redirect URL registered on the AniList application. */
export function currentRedirectUri(): string {
  return REDIRECT_URI || `${window.location.origin}/`;
}

export function getToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const expiresAt = Number(localStorage.getItem(EXPIRY_KEY) ?? "0");
    if (expiresAt && Date.now() > expiresAt) {
      clearToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function saveToken(token: string, expiresIn?: number | null): void {
  // AniList tokens are valid for 1 year from issue (official docs). Some token
  // responses carry a much shorter `expires_in` that does NOT reflect that —
  // never trust one under a week, or the app would silently log users out and
  // drop them into unfiltered guest browsing. The API's own 401 stays the
  // authority on genuinely dead tokens.
  const lifetimeMs =
    typeof expiresIn === "number" && expiresIn > 60 * 60 * 24 * 7
      ? expiresIn * 1000
      : 365 * 24 * 60 * 60 * 1000;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + lifetimeMs));
  } catch {
    // Storage unavailable (private mode) — session-only token.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  } catch {
    // ignore
  }
}

/** URL the user visits to approve the app (OAuth2 Authorization Code Grant). */
export function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: currentRedirectUri(),
  });
  return `https://anilist.co/api/v2/oauth/authorize?${params.toString()}`;
}

/**
 * The Authorization Code Grant redirects back with `?code=...` in the query
 * string. Read it once, then scrub it from the address bar.
 */
export function consumeAuthCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error_description") ?? params.get("error");
  const code = params.get("code");

  window.history.replaceState({}, "", window.location.pathname + window.location.hash);

  if (error && !code) throw new Error(error);
  return code;
}

/**
 * Exchange the authorization code for an access token via our serverless
 * endpoint, which holds the client secret (`/api/token`).
 */
export async function exchangeCode(
  code: string,
): Promise<{ token: string; expiresIn: number | null }> {
  const redirectUri = currentRedirectUri();
  const origin = new URL(redirectUri).origin;

  let res: Response;
  try {
    res = await fetch(new URL("/api/token", origin).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
  } catch {
    throw new Error("Couldn't reach the login service — check your connection.");
  }

  const data = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number | null; error_description?: string; error?: string }
    | null;

  if (!res.ok || !data?.access_token) {
    throw new Error(
      data?.error_description ??
        data?.error ??
        `Login failed (HTTP ${res.status}). Try again in a moment.`,
    );
  }
  return { token: data.access_token, expiresIn: data.expires_in ?? null };
}
