import Axios from 'axios';
import axios from 'axios';
import {
  getFromLocalStorageWithExpiry,
  setLocalStorageWithExpiry,
} from '../localstorage';

/* =========================
   CONFIG
========================= */
const client_id = process.env.REACT_APP_SPOTIFY_CLIENT_ID as string;
const redirect_uri = process.env.REACT_APP_SPOTIFY_REDIRECT_URL as string;

const authUrl = new URL('https://accounts.spotify.com/authorize');

/* =========================
   SCOPES
========================= */
const SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-top-read',
  'user-read-recently-played',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
];

/* =========================
   HELPERS
========================= */
const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64encode = (input: ArrayBuffer) => {
  const bytes = new Uint8Array(input);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));

  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const generateRandomString = (length: number) => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  const values = crypto.getRandomValues(new Uint8Array(length));

  return values.reduce((acc, x) => acc + chars[x % chars.length], '');
};

/* =========================
   LOGIN (PKCE)
========================= */
const logInWithSpotify = async (anonymous?: boolean) => {
  let codeVerifier = localStorage.getItem('code_verifier');

  if (!codeVerifier) {
    codeVerifier = generateRandomString(64);
    localStorage.setItem('code_verifier', codeVerifier);
  }

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  authUrl.search = new URLSearchParams({
    client_id,
    redirect_uri,
    response_type: 'code',
    scope: anonymous ? '' : SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: codeChallenge, // ✅ FIXED HERE
  }).toString();

  window.location.href = authUrl.toString();
};

/* =========================
   TOKEN EXCHANGE
========================= */
const requestToken = async (code: string) => {
  const code_verifier = localStorage.getItem('code_verifier');

  const body = new URLSearchParams({
    client_id,
    grant_type: 'authorization_code',
    code,
    redirect_uri,
    code_verifier: code_verifier || '',
  });

  const { data } = await Axios.post(
    'https://accounts.spotify.com/api/token',
    body,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  if (data.access_token) {
    setLocalStorageWithExpiry(
      'access_token',
      data.access_token,
      data.expires_in * 3600
    );

    axios.defaults.headers.common['Authorization'] =
      'Bearer ' + data.access_token;

    localStorage.setItem('refresh_token', data.refresh_token);
  }

  return data.access_token;
};

/* =========================
   GET TOKEN (NO LOOP FIX)
========================= */
const getToken = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    // ✅ STOP LOOP IMMEDIATELY
    window.history.replaceState({}, document.title, '/callback');

    const token = await requestToken(code);
    return [token, true] as const;
  }

  const token = getFromLocalStorageWithExpiry('access_token');

  if (token) {
    return [token, true] as const;
  }

  return [null, false] as const;
};

/* =========================
   REFRESH TOKEN
========================= */
const getRefreshToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');

  if (!refreshToken) return null;

  const body = new URLSearchParams({
    client_id,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
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

    axios.defaults.headers.common['Authorization'] =
      'Bearer ' + data.access_token;
  }

  return data.access_token;
};

/* =========================
   EXPORT (IMPORTANT)
========================= */
const spotifyLogin = {
  logInWithSpotify,
  getToken,
  getRefreshToken,
};

export default spotifyLogin;