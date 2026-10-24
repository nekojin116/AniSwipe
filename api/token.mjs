// Token exchange for the AniList Authorization Code Grant.
// Runs server-side (Vercel function / Vite dev middleware) so the client
// secret is never shipped to the browser.
//
// POST /api/token  { code, redirect_uri }
//   -> 200 { access_token, token_type, expires_in }
//   -> 4xx/5xx { error, error_description? }

const TOKEN_ENDPOINT = "https://anilist.co/api/v2/oauth/token";

/**
 * Read an environment variable defensively. Hosting dashboards often keep
 * pasted whitespace, surrounding quotes, or a BOM — any of which makes AniList
 * reject an otherwise-correct client secret with `invalid_client`.
 */
function readEnv(name) {
  const raw = process.env[name];
  if (typeof raw !== "string") return "";
  let value = raw.replace(/^\uFEFF/, "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

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

  const clientId = readEnv("VITE_ANILIST_CLIENT_ID");
  const clientSecret = readEnv("ANILIST_CLIENT_SECRET");
  const expectedRedirect = readEnv("VITE_ANILIST_REDIRECT_URI");

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
      // AniList replies with `message` where OAuth normally uses `error_description`.
      const description =
        data.error_description ?? data.message ?? "AniList rejected the token exchange.";

      if (data.error === "invalid_client") {
        return send(res, 502, {
          error: "invalid_client",
          error_description:
            `AniList rejected the server's client credentials (client ID ${clientId}). ` +
            "ANILIST_CLIENT_SECRET must belong to that AniList application and contain no " +
            "stray whitespace or quotes. Update the server environment variables and redeploy.",
        });
      }

      if (data.error === "invalid_grant") {
        return send(res, 502, {
          error: "invalid_grant",
          error_description: "That login link expired or was already used — start the login again.",
        });
      }

      return send(res, 502, {
        error: data.error ?? "exchange_failed",
        error_description: description,
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
