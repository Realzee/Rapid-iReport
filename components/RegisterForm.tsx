import React, { useState } from 'react';
import { UserIcon, MailIcon, LockIcon } from './icons';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    setLoading(true);

    // Use the v2 signUp method with `options` for metadata.
    // @ts-ignore - FIX: Property 'signUp' does not exist on type 'SupabaseAuthClient'. Using older version syntax.
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            }
        }
    });

    setLoading(false);

    if (error) {
      addToast(`Registration failed: ${error.message}`, 'error');
    } else {
      addToast('Success! Please check your email for a verification link to complete your registration.', 'success');
      onSwitchToLogin();
    }
  };
  
  const inputContainerClasses = "mt-1 relative";
  const iconClasses = "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none";
  const inputClasses = "w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-md py-3 pl-10 pr-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition";
  const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";


  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Create an Account</h2>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Join the community safety network.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="full_name_reg" className={labelClasses}>Full Name</label>
          <div className={inputContainerClasses}>
            <div className={iconClasses}><UserIcon className="w-5 h-5 text-gray-400" /></div>
            <input id="full_name_reg" name="fullName" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClasses} placeholder="John Doe" />
          </div>
        </div>
        <div>
          <label htmlFor="email_reg" className={labelClasses}>Email Address</label>
          <div className={inputContainerClasses}>
            <div className={iconClasses}><MailIcon className="w-5 h-5 text-gray-400" /></div>
            <input id="email_reg" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} placeholder="you@example.com" />
          </div>
        </div>
        <div>
          <label htmlFor="password_reg" className={labelClasses}>Password</label>
          <div className={inputContainerClasses}>
            <div className={iconClasses}><LockIcon className="w-5 h-5 text-gray-400" /></div>
            <input id="password_reg" name="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClasses} placeholder="••••••••" />
          </div>
        </div>
        <div>
          <label htmlFor="confirm_password_reg" className={labelClasses}>Confirm Password</label>
          <div className={inputContainerClasses}>
            <div className={iconClasses}><LockIcon className="w-5 h-5 text-gray-400" /></div>
            <input id="confirm_password_reg" name="confirmPassword" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClasses} placeholder="••••••••" />
          </div>
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:scale-105 transition-transform duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Create Account'}
          </button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
          Sign In
        </button>
      </p>
    </div>
  );
};

export default RegisterForm;