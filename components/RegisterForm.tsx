import React, { useState } from 'react';
import { UserIcon, MailIcon, BuildingIcon, PhoneIcon } from './icons';
import { supabase } from '../utils/supabase';
import { UserRole } from '../types';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [message, setMessage] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error: insertError } = await supabase
      .from('registration_requests')
      .insert({
        full_name: fullName,
        email: email,
        phone_number: phoneNumber,
        company_name: companyName || null,
        message: message,
      });

    if (insertError) {
      setError(`Registration failed: ${insertError.message}. Please try again.`);
    } else {
      setSuccess("Your registration request has been submitted successfully. An administrator will review your application and create an account for you. You can also email us at i-report@rapid911.co.za for any inquiries.");
      // Reset form
      setFullName('');
      setEmail('');
      setPhoneNumber('');
      setCompanyName('');
      setMessage('');
    }
    setLoading(false);
  };
  
  if (success) {
    return (
        <div className="w-full max-w-md text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Request Submitted</h2>
            <p className="text-green-600 dark:text-green-400 bg-green-500/10 dark:bg-green-400/20 p-4 rounded-md mb-6">{success}</p>
            <button onClick={onSwitchToLogin} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:scale-105 transition-transform duration-300">
              Return to Login
            </button>
        </div>
    );
  }

  const inputClasses = "w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-md py-3 pl-10 pr-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition";
  const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Request an Account</h2>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Submit your details for review by our administrators.</p>

      {error && <p className="mb-4 text-center text-red-500 dark:text-red-400 bg-red-500/10 dark:bg-red-500/20 p-3 rounded-md">{error}</p>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Personal Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="full-name" className={labelClasses}>Full Name</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon className="w-5 h-5 text-gray-400" /></div><input id="full-name" name="full_name" type="text" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClasses} placeholder="John Doe"/></div>
            </div>
             <div>
              <label htmlFor="email-register" className={labelClasses}>Email</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MailIcon className="w-5 h-5 text-gray-400" /></div><input id="email-register" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} placeholder="you@example.com"/></div>
            </div>
        </div>
        
        {/* Phone */}
        <div>
            <label htmlFor="phone" className={labelClasses}>Phone Number</label>
            <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><PhoneIcon className="w-5 h-5 text-gray-400" /></div><input id="phone" name="phone" type="tel" autoComplete="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className={inputClasses} placeholder="012 345 6789"/></div>
        </div>

        {/* Company Info */}
        <div>
          <label htmlFor="company" className={labelClasses}>Company Name (Optional)</label>
          <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><BuildingIcon className="w-5 h-5 text-gray-400" /></div><input id="company" name="company" type="text" autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClasses} placeholder="Your Company Inc."/></div>
        </div>
        
        {/* Message */}
        <div>
            <label htmlFor="message" className={labelClasses}>Reason for Account Request</label>
            <textarea id="message" name="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-md py-3 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" placeholder="e.g., 'I am a response officer for ABC Security.'"></textarea>
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:scale-105 transition-transform duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Submit Request'}
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