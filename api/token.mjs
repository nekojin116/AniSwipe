// Token exchange for the AniList Authorization Code Grant.
// Runs server-side (Vercel function / Vite dev middleware) so the client
// secret is never shipped to the browser.
//
// POST /api/token  { code, redirect_uri }
//   -> 200 { access_token, token_type, expires_in }
//   -> 4xx/5xx { error, error_description? }

const TOKEN_ENDPOINT = "https://anilist.co/api/v2/oauth/token";

function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "method_not_allowed" });
  }

  const clientId = process.env.VITE_ANILIST_CLIENT_ID;
  const clientSecret = process.env.ANILIST_CLIENT_SECRET;
  const expectedRedirect = process.env.VITE_ANILIST_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    return send(res, 500, {
      error: "server_misconfigured",
      error_description: "Missing VITE_ANILIST_CLIENT_ID or ANILIST_CLIENT_SECRET on the server.",
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: "invalid_request", error_description: "Invalid JSON body." });
  }

  const { code, redirect_uri: redirectUri } = body ?? {};
  if (!code || typeof code !== "string") {
    return send(res, 400, { error: "invalid_request", error_description: "Missing authorization code." });
  }
  if (!redirectUri || typeof redirectUri !== "string") {
    return send(res, 400, { error: "invalid_request", error_description: "Missing redirect_uri." });
  }

  // Reject cross-origin callers and non-registered redirect URIs outright.
  const origin = req.headers.origin;
  if (origin && origin !== new URL(redirectUri).origin) {
    return send(res, 403, { error: "forbidden", error_description: "Origin does not match redirect_uri." });
  }
  if (expectedRedirect && redirectUri !== expectedRedirect) {
    return send(res, 403, { error: "forbidden", error_description: "redirect_uri is not registered." });
  }

  try {
    const upstream = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || !data.access_token) {
      return send(res, 502, {
        error: data.error ?? "exchange_failed",
        error_description: data.error_description ?? data.message ?? "AniList rejected the token exchange.",
      });
    }

    return send(res, 200, {
      access_token: data.access_token,
      token_type: data.token_type ?? "Bearer",
      expires_in: data.expires_in ?? null,
    });
  } catch (err) {
    return send(res, 502, {
      error: "exchange_failed",
      error_description: err instanceof Error ? err.message : "Token exchange failed.",
    });
  }
}
