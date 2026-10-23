import { useCallback, useEffect, useState } from "react";
import Landing from "./components/Landing";
import SwipeApp from "./components/SwipeApp";
import SakuraLayer from "./components/SakuraLayer";
import { Spinner } from "./components/icons";
import { AlError, fetchViewer, type Viewer } from "./lib/anilist";
import {
  buildAuthUrl,
  clearToken,
  consumeAuthCode,
  exchangeCode,
  getToken,
  hasClientConfig,
  saveToken,
} from "./lib/auth";

export default function App() {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [guest, setGuest] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Complete the Authorization Code Grant: ?code=... -> /api/token -> token.
  useEffect(() => {
    let code: string | null;
    try {
      code = consumeAuthCode();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Authorization was cancelled.");
      return;
    }
    if (!code) return;

    setExchanging(true);
    exchangeCode(code)
      .then((result) => {
        saveToken(result.token, result.expiresIn);
        setNotice(null);
        setToken(result.token);
      })
      .catch((err) => setNotice(err instanceof Error ? err.message : "Login failed."))
      .finally(() => setExchanging(false));
  }, []);

  const loadViewer = useCallback((accessToken: string) => {
    setViewerLoading(true);
    setViewerError(null);
    fetchViewer(accessToken)
      .then((v) => setViewer(v))
      .catch((err) => {
        const alErr = err instanceof AlError ? err : new AlError(String(err));
        if (alErr.status === 401) {
          clearToken();
          setToken(null);
          setViewer(null);
          setNotice("Your AniList session expired — please log in again.");
        } else {
          setViewerError(alErr.message);
        }
      })
      .finally(() => setViewerLoading(false));
  }, []);

  useEffect(() => {
    if (token) loadViewer(token);
  }, [token, loadViewer]);

  const handleLogin = useCallback(() => {
    if (!hasClientConfig()) {
      setGuest(false);
      setNotice("Set VITE_ANILIST_CLIENT_ID in your .env file to enable login — see README.");
      return;
    }
    window.location.href = buildAuthUrl();
  }, []);

  const handleLogout = useCallback((message?: string) => {
    clearToken();
    setToken(null);
    setViewer(null);
    setViewerError(null);
    setNotice(message ?? null);
  }, []);

  const handleSessionExpired = useCallback(() => {
    handleLogout("Your AniList session expired — please log in again.");
  }, [handleLogout]);

  let screen: React.ReactNode;

  if (exchanging) {
    screen = (
      <div className="relative z-10 flex min-h-full flex-col items-center justify-center gap-4">
        <Spinner className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-stone-500">Completing login with AniList…</p>
      </div>
    );
  } else if (token && viewer) {
    screen = (
      <SwipeApp
        token={token}
        viewer={viewer}
        onLogin={handleLogin}
        onLogout={() => handleLogout("Logged out.")}
        onSessionExpired={handleSessionExpired}
      />
    );
  } else if (token) {
    screen = viewerLoading || !viewerError ? (
      <div className="relative z-10 flex min-h-full flex-col items-center justify-center gap-4">
        <Spinner className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-stone-500">Connecting to your AniList…</p>
      </div>
    ) : (
      <div className="relative z-10 flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="font-display text-xl font-semibold text-stone-900">Something went wrong</h2>
        <p className="max-w-sm text-sm text-stone-500">{viewerError}</p>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => loadViewer(token)}
            className="brand-gradient rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:scale-105"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => handleLogout()}
            className="glass rounded-full px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-900/5"
          >
            Log out
          </button>
        </div>
      </div>
    );
  } else if (guest) {
    screen = (
      <SwipeApp
        token={null}
        viewer={null}
        onLogin={handleLogin}
        onLogout={() => setGuest(false)}
        onSessionExpired={handleSessionExpired}
      />
    );
  } else {
    screen = (
      <Landing
        onLogin={handleLogin}
        onBrowse={() => setGuest(true)}
        notice={notice}
        configMissing={!hasClientConfig()}
      />
    );
  }

  return (
    <div className="relative min-h-full overflow-x-hidden">
      {/* Ambient background */}
      <div className="blob left-[-12%] top-[-14%] h-[460px] w-[460px] bg-rose-400" />
      <div className="blob blob-b right-[-10%] top-[30%] h-[420px] w-[420px] bg-pink-300" />
      <div className="blob left-[35%] bottom-[-16%] h-[380px] w-[380px] bg-rose-300" />
      <SakuraLayer />
      {screen}
    </div>
  );
}
