import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { loginToSpotify } from '../store/slices/auth';
import { useNavigate } from 'react-router-dom';

const Callback = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      // 🔥 IMPORTANT: check if Spotify returned code
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      // If no code → stop
      if (!code) {
        navigate('/');
        return;
      }

      try {
        // 🔥 run login flow (this will internally exchange token)
        await dispatch(loginToSpotify(true) as any);

        // 🔥 CRITICAL: remove code immediately to stop loop
        window.history.replaceState({}, document.title, '/');

        // go home
        navigate('/');
      } catch (err) {
        console.error('Login callback error:', err);
        navigate('/');
      }
    };

    run();
  }, [dispatch, navigate]);

  return <div>Logging in...</div>;
};

export default Callback;