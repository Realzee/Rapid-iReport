import React, { useState, useEffect } from 'react';
import { MailIcon, LockIcon } from './icons';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';

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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { addToast } = useToast();

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
      addToast(error.message, 'error');
	  setIsDirty(true); // set dirty back if login fails
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Welcome Back</h2>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Sign in to access the Control Center.</p>
      
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
              className="w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-md py-3 pl-10 pr-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
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
              className="w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-md py-3 pl-10 pr-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex justify-center"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Sign In'}
          </button>
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
    </div>
  );
};

export default LoginForm;