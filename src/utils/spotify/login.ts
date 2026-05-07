import axios from 'axios';
import Axios from 'axios';
import {
  getFromLocalStorageWithExpiry,
  setLocalStorageWithExpiry,
} from '../localstorage';

/* =========================
   CONFIG
========================= */
const client_id =
  process.env.REACT_APP_SPOTIFY_CLIENT_ID as string;

const redirect_uri =
  process.env.REACT_APP_SPOTIFY_REDIRECT_URL as string;

const authUrl = new URL(
  'https://accounts.spotify.com/authorize'
);

/* =========================
   SCOPES
========================= */
const SCOPES = [
  'user-read-recently-played',
  'user-top-read',
  'user-read-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
];

/* =========================
   SAFE SHA256
========================= */
const sha256 = async (plain: string) => {
  if (!window.crypto?.subtle) {
    throw new Error(
      'Crypto API not available. Use HTTPS or localhost.'
    );
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(plain);

  return window.crypto.subtle.digest('SHA-256', data);
};

/* =========================
   BASE64 ENCODE
========================= */
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

/* =========================
   RANDOM STRING
========================= */
const generateRandomString = (length: number) => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  const values = crypto.getRandomValues(
    new Uint8Array(length)
  );

  return values.reduce(
    (acc, x) => acc + chars[x % chars.length],
    ''
  );
};

/* =========================
   LOGIN (NO LOOP SAFE)
========================= */
const logInWithSpotify = () => {
  const verifier =
    localStorage.getItem('code_verifier') ||
    generateRandomString(64);

  localStorage.setItem('code_verifier', verifier);

  sha256(verifier).then((hashed) => {
    const challenge = base64encode(hashed);

    authUrl.search = new URLSearchParams({
      client_id,
      response_type: 'code',
      redirect_uri,
      scope: SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: challenge,
    }).toString();

    window.location.href = authUrl.toString();
  });
};

/* =========================
   TOKEN EXCHANGE
========================= */
const requestToken = async (code: string) => {
  const verifier =
    localStorage.getItem('code_verifier') || '';

  const body = new URLSearchParams({
    client_id,
    grant_type: 'authorization_code',
    code,
    redirect_uri,
    code_verifier: verifier,
  });

  const { data } = await Axios.post(
    'https://accounts.spotify.com/api/token',
    body
  );

  if (data.access_token) {
    setLocalStorageWithExpiry(
      'access_token',
      data.access_token,
      data.expires_in * 3600
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
};

/* =========================
   GET TOKEN (🔥 LOOP FIXED)
========================= */
const getToken = async () => {
  const stored =
    getFromLocalStorageWithExpiry('access_token');

  if (stored) return [stored, true];

  const params = new URLSearchParams(
    window.location.search
  );
  const code = params.get('code');

  // 🔥 IMPORTANT: STOP REPEATED CALLBACK EXECUTION
  const used = sessionStorage.getItem(
    'spotify_code_used'
  );

  if (code && !used) {
    sessionStorage.setItem(
      'spotify_code_used',
      'true'
    );

    const token = await requestToken(code);

    // clean URL once
    window.history.replaceState({}, '', '/');

    return [token, true];
  }

  return [null, false];
};

/* =========================
   REFRESH TOKEN
========================= */
export const getRefreshToken = async () => {
  const refreshToken =
    localStorage.getItem('refresh_token');

  if (!refreshToken) return null;

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

  if (data.access_token) {
    setLocalStorageWithExpiry(
      'access_token',
      data.access_token,
      data.expires_in * 3600
    );
  }

  return data.access_token;
};

/* =========================
   EXPORT
========================= */
export default {
  logInWithSpotify,
  getToken,
  getRefreshToken,
};