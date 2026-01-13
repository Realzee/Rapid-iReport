import React from 'react';
import { MailIcon, LockIcon } from './icons';

interface LoginFormProps {
  onLoginSuccess: () => void;
  onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd handle form validation and API calls here
    onLoginSuccess();
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-bold text-center text-white mb-2">Welcome Back</h2>
      <p className="text-center text-gray-400 mb-8">Sign in to access the Control Center.</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email Address</label>
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
              className="w-full bg-gray-900/50 border border-gray-700 rounded-md py-3 pl-10 pr-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <div>
          <label htmlFor="password"className="block text-sm font-medium text-gray-300">Password</label>
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
              className="w-full bg-gray-900/50 border border-gray-700 rounded-md py-3 pl-10 pr-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div>
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:scale-105 transition-transform duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-blue-500"
          >
            Sign In
          </button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-gray-400">
        Don't have an account?{' '}
        <button onClick={onSwitchToRegister} className="font-medium text-blue-400 hover:text-blue-300">
          Sign Up
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
