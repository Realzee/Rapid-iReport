import React from 'react';
import { UserIcon, MailIcon, LockIcon } from './icons';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd handle registration logic and API calls
    // For now, we can just switch to login as a mock success
    alert("Registration successful! Please sign in.");
    onSwitchToLogin();
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-bold text-center text-white mb-2">Create an Account</h2>
      <p className="text-center text-gray-400 mb-8">Join the community safety network.</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="full-name" className="block text-sm font-medium text-gray-300">Full Name</label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <UserIcon className="w-5 h-5 text-gray-400" />
            </div>
            <input
              id="full-name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              className="w-full bg-gray-900/50 border border-gray-700 rounded-md py-3 pl-10 pr-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="Jane Doe"
            />
          </div>
        </div>
        <div>
          <label htmlFor="email-register" className="block text-sm font-medium text-gray-300">Email Address</label>
          <div className="mt-1 relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MailIcon className="w-5 h-5 text-gray-400" />
            </div>
            <input
              id="email-register"
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
          <label htmlFor="password-register" className="block text-sm font-medium text-gray-300">Password</label>
          <div className="mt-1 relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LockIcon className="w-5 h-5 text-gray-400" />
            </div>
            <input
              id="password-register"
              name="password"
              type="password"
              autoComplete="new-password"
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
            Create Account
          </button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-gray-400">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="font-medium text-blue-400 hover:text-blue-300">
          Sign In
        </button>
      </p>
    </div>
  );
};

export default RegisterForm;
