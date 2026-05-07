import Axios from 'axios';
import axios from 'axios';
import {
  getFromLocalStorageWithExpiry,
  setLocalStorageWithExpiry,
} from '../localstorage';

/* ================================
   🎯 CONFIG
================================ */
const client_id = process.env.REACT_APP_SPOTIFY_CLIENT_ID as string;
const redirect_uri = process.env.REACT_APP_SPOTIFY_REDIRECT_URL as string;

const authUrl = new URL('https://accounts.spotify.com/authorize');

/* ================================
   🔑 SCOPES
================================ */
const SCOPES = [
  'ugc-image-upload',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-collaborative',
  'user-follow-modify',
  'user-follow-read',
  'user-read-playback-position',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
  'user-library-modify',
] as const;

/* ================================
   🔐 SHA256 FIX (SAFE)
================================ */
const sha256 = async (plain: string) => {
  if (!window.crypto?.subtle) {
    throw new Error(
      'Crypto API not available. Use HTTPS or modern browser.'
    );
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(plain);

  return window.crypto.subtle.digest('SHA-256', data);
};

/* ================================
   🔁 BASE64 FIX
================================ */
const base64encode = (input: ArrayBuffer) => {
  const bytes = new Uint8Array(input);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

/* ================================
   🔄 RANDOM STRING
================================ */
const generateRandomString = (length: number) => {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  const values = crypto.getRandomValues(new Uint8Array(length));

  return values.reduce(
    (acc, x) => acc + possible[x % possible.length],
    ''
  );
};

/* ================================
   🚀 LOGIN
================================ */
const logInWithSpotify = async (anonymous?: boolean) => {
  let codeVerifier = localStorage.getItem('code_verifier');

  if (!codeVerifier) {
    codeVerifier = generateRandomString(64);
    localStorage.setItem('code_verifier', codeVerifier);
  }

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  authUrl.search = new URLSearchParams(
    anonymous
      ? {
          client_id,
          redirect_uri,
          response_type: 'code', // 'token' replaced with 'code' for PKCE flow
          scope: '',
        }
      : {
          client_id,
          redirect_uri,
          response_type: 'code',
          scope: SCOPES.join(' '),
          code_challenge_method: 'S256',
          code_challenge,
        }
  ).toString();

  window.location.href = authUrl.toString();
};

/* ================================
   🔥 TOKEN EXCHANGE (FIXED - IMPORTANT)
================================ */
const requestToken = async (code: string) => {
  const code_verifier = localStorage.getItem('code_verifier');

  const body = new URLSearchParams({
    code,
    client_id,
    redirect_uri,
    code_verifier: code_verifier || '',
    grant_type: 'authorization_code',
  });

  try {
    const { data } = await Axios.post(
      'https://accounts.spotify.com/api/token',
      body,
      {
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
      }
    );

    if (data.access_token) {
      setLocalStorageWithExpiry(
        'access_token',
        data.access_token,
        data.expires_in * 60 * 60
      );

      axios.defaults.headers.common[
        'Authorization'
      ] = `Bearer ${data.access_token}`;

      localStorage.setItem(
        'refresh_token',
        data.refresh_token
      );
    }

    return data.access_token;
  } catch (err) {
    console.error('❌ Token exchange failed:', err);
    return null;
  }
};

/* ================================
   🔍 GET TOKEN (FIXED CALLBACK FLOW)
================================ */
const getToken = async () => {
  const stored = getFromLocalStorageWithExpiry(
    'access_token'
  );

  if (stored) return [stored, true];

  const urlParams = new URLSearchParams(
    window.location.search
  );

  const code = urlParams.get('code');

  // ✅ CALLBACK FIX (MAIN ISSUE YOU HAD)
  if (code) {
    const token = await requestToken(code);

    // IMPORTANT: remove ?code=xxx from URL
    window.history.replaceState({}, '', '/');

    return [token, true];
  }

  const publicToken = getFromLocalStorageWithExpiry(
    'public_access_token'
  );

  if (publicToken) return [publicToken, false];

  const hashToken = window.location.hash
    .split('&')[0]
    ?.split('=')[1];

  if (hashToken) {
    setLocalStorageWithExpiry(
      'public_access_token',
      hashToken,
      3600
    );

    window.location.hash = '';
    return [hashToken, false];
  }

  return [null, false];
};

/* ================================
   🔄 REFRESH TOKEN (FIXED)
================================ */
export const getRefreshToken = async () => {
  const refreshToken =
    localStorage.getItem('refresh_token');

  if (!refreshToken) {
    logInWithSpotify(true);
    return null;
  }

  const res = await fetch(
    'https://accounts.spotify.com/api/token',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    }
  );

  const data = await res.json();

  if (!data.access_token) {
    logInWithSpotify(true);
    return null;
  }

  setLocalStorageWithExpiry(
    'access_token',
    data.access_token,
    data.expires_in * 60 * 60
  );

  axios.defaults.headers.common[
    'Authorization'
  ] = `Bearer ${data.access_token}`;

  return data.access_token;
};

/* ================================
   📦 EXPORT
================================ */
export default {
  logInWithSpotify,
  getToken,
  getRefreshToken,
};