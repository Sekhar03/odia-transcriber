import React, { useState, useEffect } from 'react';
import { CheckCircle2, LogOut, RefreshCw } from 'lucide-react';
import {
  fetchGoogleUserProfile,
  isGoogleAuthConfigured,
  requestGoogleAccessToken,
  revokeGoogleAccessToken,
  getGoogleClientId,
  setGoogleClientId
} from './youtubeCaptionClient';

const GoogleLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.991 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.991 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

export default function GoogleSignInButton({
  accessToken,
  userProfile,
  onSignedIn,
  onSignedOut,
  onError,
  compact = false
}) {
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(isGoogleAuthConfigured());

  useEffect(() => {
    const handleConfigChange = () => {
      setConfigured(isGoogleAuthConfigured());
    };
    window.addEventListener('google-client-id-changed', handleConfigChange);
    return () => window.removeEventListener('google-client-id-changed', handleConfigChange);
  }, []);

  const handleSignIn = async () => {
    if (!isGoogleAuthConfigured()) {
      const userInput = window.prompt(
        "Google Sign-In is not configured.\n\n" +
        "Please enter your Google OAuth Client ID to enable it (find it in Google Cloud Console):"
      );
      if (!userInput) return;
      const trimmed = userInput.trim();
      if (trimmed) {
        setGoogleClientId(trimmed);
        window.dispatchEvent(new Event('google-client-id-changed'));
      } else {
        return;
      }
    }

    setLoading(true);
    try {
      const token = await requestGoogleAccessToken({ forceAccountPicker: !accessToken });
      const profile = await fetchGoogleUserProfile(token);
      onSignedIn?.({ accessToken: token, profile });
    } catch (err) {
      onError?.(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (accessToken) {
      try {
        await revokeGoogleAccessToken(accessToken);
      } catch (e) {}
    }
    onSignedOut?.();
  };

  if (accessToken && userProfile) {
    return (
      <div className={`flex ${compact ? 'flex-col items-stretch gap-2' : 'flex-col sm:flex-row sm:items-center gap-3'} rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3`}>
        <div className="flex items-center gap-3 min-w-0">
          {userProfile.picture ? (
            <img
              src={userProfile.picture}
              alt={userProfile.name || 'Google user'}
              className="w-9 h-9 rounded-full border border-emerald-400/40 shrink-0"
            />
          ) : (
            <CheckCircle2 className="w-9 h-9 text-emerald-400 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-100 truncate">
              {userProfile.name || 'Signed in with Google'}
            </p>
            <p className="text-xs text-emerald-200/70 truncate">{userProfile.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition ${compact ? 'w-full' : 'shrink-0'}`}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${compact ? 'w-full' : ''}`}
      title={configured ? 'Sign in with Google to fetch YouTube captions' : 'Click to configure Google Client ID and sign in'}
    >
      {loading ? (
        <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
      ) : (
        <GoogleLogo />
      )}
      <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
    </button>
  );
}
