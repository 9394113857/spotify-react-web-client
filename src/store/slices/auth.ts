import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from '../../axios';
import login from '../../utils/spotify/login';
import { getFromLocalStorageWithExpiry } from '../../utils/localstorage';
import { authService } from '../../services/auth';

/* =========================
   STATE
========================= */
type AuthState = {
  token?: string;
  playerLoaded: boolean;
  user?: any;
  requesting: boolean;
};

const initialState: AuthState = {
  token: undefined,
  playerLoaded: false,
  user: undefined,
  requesting: true,
};

/* =========================
   LOGIN THUNK (FINAL FIX)
========================= */
export const loginToSpotify = createAsyncThunk<
  { token?: string; loaded: boolean },
  boolean | undefined
>('auth/loginToSpotify', async (anonymous, api) => {
  const userToken =
    getFromLocalStorageWithExpiry('access_token') as string | null;

  const publicToken =
    getFromLocalStorageWithExpiry('public_access_token') as string | null;

  const token = userToken || publicToken || undefined;

  /* -------------------------
     CASE 1: TOKEN EXISTS
  ------------------------- */
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    api.dispatch(fetchUser());

    return { token, loaded: true };
  }

  /* -------------------------
     CASE 2: LOGIN FLOW
  ------------------------- */
  const [requestedToken] = await login.getToken();

  if (!requestedToken) {
    login.logInWithSpotify(anonymous);
    return { token: undefined, loaded: false };
  }

  axios.defaults.headers.common['Authorization'] =
    `Bearer ${requestedToken}`;

  return { token: requestedToken, loaded: true };
});

/* =========================
   FETCH USER
========================= */
export const fetchUser = createAsyncThunk(
  'auth/fetchUser',
  async () => {
    const res = await authService.fetchUser();
    return res.data;
  }
);

/* =========================
   SLICE
========================= */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<{ token?: string }>) {
      state.token = action.payload.token;
    },
    setPlayerLoaded(
      state,
      action: PayloadAction<{ playerLoaded: boolean }>
    ) {
      state.playerLoaded = action.payload.playerLoaded;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loginToSpotify.fulfilled, (state, action) => {
      state.token = action.payload.token;
      state.requesting = false;
    });

    builder.addCase(fetchUser.fulfilled, (state, action) => {
      state.user = action.payload;
      state.requesting = false;
    });
  },
});

/* =========================
   EXPORTS
========================= */
export const authActions = {
  ...authSlice.actions,
  loginToSpotify,
  fetchUser,
};

export default authSlice.reducer;