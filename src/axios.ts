import Axios from 'axios';
import login from './utils/spotify/login';
import { getFromLocalStorageWithExpiry } from './utils/localstorage';

const BASE_URL = 'https://api.spotify.com/v1';

const axios = Axios.create({
  baseURL: BASE_URL,
});

/* =========================
   SET INITIAL TOKEN
========================= */
const token = getFromLocalStorageWithExpiry('access_token') as string | undefined;

if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

/* =========================
   RESPONSE INTERCEPTOR
========================= */
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // safety check (VERY IMPORTANT)
    if (!error.response) {
      return Promise.reject(error);
    }

    /* =========================
       HANDLE 401 (TOKEN EXPIRED)
    ========================= */
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await login.getRefreshToken();

        if (!newToken) {
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('access_token');
          return Promise.reject(error);
        }

        axios.defaults.headers.common['Authorization'] =
          `Bearer ${newToken}`;

        originalRequest.headers['Authorization'] =
          `Bearer ${newToken}`;

        return axios(originalRequest);
      } catch (err) {
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('access_token');
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default axios;