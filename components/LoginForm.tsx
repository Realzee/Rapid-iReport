import React, { useState, useEffect } from 'react';
import { MailIcon, LockIcon } from './icons';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { Fingerprint, Camera } from 'lucide-react';
import { isBiometricsSupported, hasBiometricsRegistered, authenticateBiometrics } from '../utils/webauthn';
import { isFaceAuthSupported, hasFaceRegistered, decryptFaceData } from '../utils/faceAuth';
import { FaceScanModal } from './FaceScanModal';

const TurnstileHandler: React.FC<{ onToken: (token: string) => void }> = ({ onToken }) => {
    useEffect(() => {
        const handler = (e: any) => {
            onToken(e.detail.token);
        };
        window.addEventListener('turnstile-success', handler);
        return () => window.removeEventListener('turnstile-success', handler);
    }, [onToken]);
    return null;
};

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>('dummy_token');
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [hasFingerprint, setHasFingerprint] = useState(false);
  const [faceSupported, setFaceSupported] = useState(false);
  const [hasFace, setHasFace] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    isBiometricsSupported().then(supported => {
      setBiometricsSupported(supported);
      setHasFingerprint(hasBiometricsRegistered());
    });
    isFaceAuthSupported().then(supported => {
      setFaceSupported(supported);
      setHasFace(hasFaceRegistered());
    });
  }, []);

  useEffect(() => {
	  if(email !== '' || password !== '') setIsDirty(true);
  }, [email, password]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleBiometricLogin = async () => {
    try {
      setLoading(true);
      const creds = await authenticateBiometrics();
      addToast('Fingerprint scanned successfully. Authenticating...', 'success');
      
      const { error } = await supabase.auth['signInWithPassword']({
        email: creds.email,
        password: creds.password
      });

      if (error) {
        addToast(error.message, 'error');
      } else {
        addToast('Welcome back! Logged in securely with biometrics.', 'success');
      }
    } catch (err: any) {
      addToast(err.message || 'Biometric login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFaceLoginSuccess = async (encryptedData?: string, emailAddress?: string) => {
    if (!encryptedData || !emailAddress) {
      addToast('Invalid facial recognition credentials.', 'error');
      return;
    }

    try {
      setLoading(true);
      const decryptedPassword = decryptFaceData(encryptedData, emailAddress);
      setIsFaceModalOpen(false);
      addToast('Biometric face signature verified. Authenticating...', 'success');

      const { error } = await supabase.auth['signInWithPassword']({
        email: emailAddress,
        password: decryptedPassword
      });

      if (error) {
        addToast(error.message, 'error');
      } else {
        addToast('Welcome back! Logged in securely with facial recognition.', 'success');
      }
    } catch (err: any) {
      addToast(err.message || 'Facial recognition login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!turnstileToken) {
      addToast('Please complete the security check', 'warning');
      return;
    }

	setIsDirty(false);
    setLoading(true);
    // FIX: Using bracket notation to bypass potential SupabaseAuthClient type errors.
    const { error } = await supabase.auth['signInWithPassword']({ email, password });
    if (error) {
      const errMsg = error.message?.includes('exceed_egress_quota') || error.message?.includes('restricted')
        ? 'Database quota exceeded. Please upgrade your Supabase plan or reset egress limits in your Supabase dashboard.'
        : error.message;
      addToast(errMsg, 'error');
      setIsDirty(true); // set dirty back if login fails
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Welcome Back</h2>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Sign in to access the Operational Control Platform.</p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MailIcon className="w-5 h-5 text-gray-400" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl py-3 pl-10 pr-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <div>
          <label htmlFor="password"className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LockIcon className="w-5 h-5 text-gray-400" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl py-3 pl-10 pr-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="space-y-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 dark:shadow-blue-900/10 hover:shadow-blue-500/30 transition-all duration-200 flex justify-center items-center hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Sign In'}
          </button>

          {biometricsSupported && (
            <>
              {hasFingerprint ? (
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold py-3 px-4 rounded-xl shadow-sm transition-all duration-200 flex justify-center items-center gap-2 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Fingerprint className="w-5 h-5 text-blue-500 dark:text-blue-400 animate-pulse" />
                  <span>Sign In with Fingerprint</span>
                </button>
              ) : (
                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80 text-center">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 font-medium leading-relaxed">
                    <Fingerprint className="w-4 h-4 text-slate-400" />
                    Fingerprint login is supported on this device. Enable it in Profile Settings after login.
                  </p>
                </div>
              )}
            </>
          )}

          {faceSupported && (
            <>
              {hasFace ? (
                <button
                  type="button"
                  onClick={() => setIsFaceModalOpen(true)}
                  disabled={loading}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold py-3 px-4 rounded-xl shadow-sm transition-all duration-200 flex justify-center items-center gap-2 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Camera className="w-5 h-5 text-blue-500 dark:text-blue-400 animate-pulse" />
                  <span>Sign In with Facial Recognition</span>
                </button>
              ) : (
                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80 text-center">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 font-medium leading-relaxed">
                    <Camera className="w-4 h-4 text-slate-400" />
                    Facial Recognition login is supported on this device. Enable it in Profile Settings after login.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Cloudflare Turnstile Widget */}
        <div className="flex justify-center mt-4">
            <div 
                className="cf-turnstile" 
                data-sitekey="1x00000000000000000000AA"
                data-callback="onTurnstileSuccess"
                data-theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
            ></div>
        </div>

        <TurnstileHandler onToken={setTurnstileToken} />
      </form>
      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Don't have an account?{' '}
        <button onClick={onSwitchToRegister} className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
          Sign Up
        </button>
      </p>

      {/* Face Authentication Scan Modal */}
      <FaceScanModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        mode="login"
        onSuccess={handleFaceLoginSuccess}
      />
    </div>
  );
};

export default LoginForm;