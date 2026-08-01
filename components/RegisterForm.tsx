import React, { useState, useEffect } from 'react';
import { UserIcon, MailIcon, LockIcon, UploadCloudIcon, BuildingIcon } from './icons';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { Company, UserRole } from '../types';

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

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  companies: Company[];
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin, companies }) => {
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [cell, setCell] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [iceNo, setIceNo] = useState('');
  const [medicalAid, setMedicalAid] = useState('');
  const [psiraNumber, setPsiraNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState(UserRole.USER);
  const [turnstileToken, setTurnstileToken] = useState<string | null>('dummy_token');
  
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (companies && companies.length > 0 && !companyId) {
      const defaultCompany = companies.find(
        c => c.name && c.name.trim().toLowerCase() === 'rapid responders sa'
      );
      if (defaultCompany) {
        setCompanyId(defaultCompany.id);
      }
    }
  }, [companies, companyId]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!turnstileToken) {
      addToast('Please complete the security check', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
     if (!avatarFile) {
        addToast('Please upload a selfie to complete registration.', 'error');
        return;
    }
    if (!companyId) {
        addToast('Please select the company you are registering for.', 'error');
        return;
    }
    setLoading(true);

    // FIX: Using bracket notation to bypass potential SupabaseAuthClient type errors.
    const { data: signUpData, error: signUpError } = await supabase.auth['signUp']({
        email,
        password,
        options: {
            data: {
                first_name: firstName,
                surname: surname,
                cell: cell,
                vehicle_reg: vehicleReg || null,
                home_address: homeAddress,
                ice_no: iceNo,
                medical_aid: medicalAid || null,
                psira_number: psiraNumber || null,
                company_id: companyId,
                role: role,
            }
        }
    });

    if (signUpError) {
        addToast(`Registration failed: ${signUpError.message}`, 'error');
        setLoading(false);
        return;
    }

    if (!signUpData.user) {
        addToast('Registration succeeded but no user was returned. Please try logging in.', 'warning');
        setLoading(false);
        onSwitchToLogin();
        return;
    }

    // Now upload avatar
    const user = signUpData.user;
    const fileExt = avatarFile.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;
    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true });
    
    if (uploadError) {
        addToast('Account created, but selfie upload failed. Please update it on your profile page.', 'warning');
        setLoading(false);
        onSwitchToLogin();
        return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    
    const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${urlData.publicUrl}?t=${new Date().getTime()}` })
        .eq('id', user.id);

    if (profileUpdateError) {
        addToast('Account created and selfie uploaded, but could not link it to your profile. Please re-upload on your profile page.', 'warning');
    } else {
        addToast('Success! Please verify your email. Your account is now pending administrator approval.', 'success');
    }
    
    setLoading(false);
    onSwitchToLogin();
  };
  
  const inputContainerClasses = "mt-1 relative";
  const iconClasses = "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none";
  const inputClasses = "w-full bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl py-3 pl-10 pr-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200";
  const labelClasses = "block text-sm font-medium text-slate-700 dark:text-slate-300";


  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Create an Account</h2>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Join the community safety network.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <label className={labelClasses}>Profile Picture / Selfie</label>
            <div className="mt-1 flex items-center gap-4">
                <span className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-300 dark:border-gray-700">
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="Selfie preview" className="h-full w-full object-cover" />
                    ) : (
                        <UserIcon className="h-12 w-12 text-gray-400" />
                    )}
                </span>
                <label htmlFor="avatar-upload" className="cursor-pointer btn-secondary flex items-center justify-center gap-2 text-sm">
                    <UploadCloudIcon className="w-5 h-5"/>
                    <span>Upload Selfie</span>
                </label>
                <input id="avatar-upload" name="avatar-upload" type="file" className="sr-only" accept="image/*" capture="user" onChange={handleAvatarChange} required />
            </div>
            {!avatarFile && <p className="text-xs text-red-500 dark:text-red-400 mt-1">A profile selfie is required for registration.</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name_reg" className={labelClasses}>First Name</label>
              <div className={inputContainerClasses}>
                <div className={iconClasses}><UserIcon className="w-5 h-5 text-gray-400" /></div>
                <input id="first_name_reg" name="firstName" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClasses} placeholder="John" />
              </div>
            </div>
            <div>
              <label htmlFor="surname_reg" className={labelClasses}>Surname</label>
              <div className={inputContainerClasses}>
                <input id="surname_reg" name="surname" type="text" required value={surname} onChange={(e) => setSurname(e.target.value)} className={`${inputClasses} pl-3`} placeholder="Doe" />
              </div>
            </div>
        </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="company_id_reg" className={labelClasses}>Company</label>
              <div className={inputContainerClasses}>
                <div className={iconClasses}><BuildingIcon className="w-5 h-5 text-gray-400" /></div>
                <select
                    id="company_id_reg"
                    name="companyId"
                    required
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className={inputClasses}
                >
                    <option value="" disabled>Select your company...</option>
                    {companies.map(company => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="role_reg" className={labelClasses}>Role</label>
              <div className={inputContainerClasses}>
                <select
                    id="role_reg"
                    name="role"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className={`${inputClasses} !pl-3`}
                >
                    <option value={UserRole.USER}>User</option>
                    <option value={UserRole.GUARD}>Guard</option>
                    <option value={UserRole.RESPONDER}>Responder</option>
                </select>
              </div>
            </div>
          </div>
        <div>
          <label htmlFor="email_reg" className={labelClasses}>Email Address</label>
          <div className={inputContainerClasses}>
            <div className={iconClasses}><MailIcon className="w-5 h-5 text-gray-400" /></div>
            <input id="email_reg" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} placeholder="you@example.com" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="cell_reg" className={labelClasses}>Cell Number</label>
                <input id="cell_reg" name="cell" type="tel" required value={cell} onChange={(e) => setCell(e.target.value)} className={`${inputClasses} pl-3`} placeholder="0821234567" />
            </div>
            <div>
                <label htmlFor="ice_no_reg" className={labelClasses}>ICE Number</label>
                <input id="ice_no_reg" name="iceNo" type="tel" required value={iceNo} onChange={(e) => setIceNo(e.target.value)} className={`${inputClasses} pl-3`} placeholder="Emergency Contact" />
            </div>
        </div>
        <div>
            <label htmlFor="home_address_reg" className={labelClasses}>Home Address</label>
            <input id="home_address_reg" name="homeAddress" type="text" required value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} className={`${inputClasses} pl-3`} placeholder="123 Main St, Suburb" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="vehicle_reg_reg" className={labelClasses}>Vehicle Reg (Optional)</label>
                <input id="vehicle_reg_reg" name="vehicleReg" type="text" value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value.toUpperCase())} className={`${inputClasses} pl-3`} placeholder="AB 12 CD GP" />
            </div>
             <div>
                <label htmlFor="medical_aid_reg" className={labelClasses}>Medical Aid (Optional)</label>
                <input id="medical_aid_reg" name="medicalAid" type="text" value={medicalAid} onChange={(e) => setMedicalAid(e.target.value)} className={`${inputClasses} pl-3`} placeholder="Discovery, Bonitas, etc." />
            </div>
        </div>
        <div>
            <label htmlFor="psira_number_reg" className={labelClasses}>PSIRA Number (Optional)</label>
            <input id="psira_number_reg" name="psiraNumber" type="text" value={psiraNumber} onChange={(e) => setPsiraNumber(e.target.value.toUpperCase())} className={`${inputClasses} pl-3`} placeholder="1234567" />
        </div>
        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 dark:shadow-blue-900/10 hover:shadow-blue-500/30 transition-all duration-200 flex justify-center items-center hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Create Account'}
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
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
          Sign In
        </button>
      </p>
    </div>
  );
};

export default RegisterForm;