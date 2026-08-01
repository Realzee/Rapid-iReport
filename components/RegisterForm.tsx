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
  
  // Onboard New Company states
  const [isOnboardNewCompany, setIsOnboardNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyContactPerson, setNewCompanyContactPerson] = useState('');
  const [newCompanyCellNumber, setNewCompanyCellNumber] = useState('');
  const [newCompanyPsira, setNewCompanyPsira] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const actualCompanies = React.useMemo(() => {
    // Only show approved companies for general registration
    const approvedOnly = (companies || []).filter(c => c.status === 'approved' || c.name?.trim().toLowerCase() === 'rapid responders sa');
    if (approvedOnly.length === 0) {
      return [{ id: 'bootstrap-pending', name: 'Rapid Responders SA' }] as Company[];
    }
    const hasDefault = approvedOnly.some(
      c => c.name && c.name.trim().toLowerCase() === 'rapid responders sa'
    );
    if (!hasDefault) {
      return [...approvedOnly, { id: 'bootstrap-pending', name: 'Rapid Responders SA' }] as Company[];
    }
    return approvedOnly;
  }, [companies]);

  useEffect(() => {
    const defaultCompany = actualCompanies.find(
      c => c.name && c.name.trim().toLowerCase() === 'rapid responders sa'
    );
    if (defaultCompany && !companyId) {
      setCompanyId(defaultCompany.id);
    }
  }, [actualCompanies, companyId]);

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
    if (!isOnboardNewCompany && !companyId) {
        addToast('Please select the company you are registering for.', 'error');
        return;
    }
    setLoading(true);

    let targetCompanyId = companyId === 'bootstrap-pending' ? null : companyId;

    if (isOnboardNewCompany) {
      if (!newCompanyName.trim() || !newCompanyContactPerson.trim() || !newCompanyCellNumber.trim()) {
        addToast('Please complete all required company onboarding fields.', 'error');
        setLoading(false);
        return;
      }
      try {
        const companyRes = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newCompanyName,
            contact_person: newCompanyContactPerson,
            cell_number: newCompanyCellNumber,
            psira_number: newCompanyPsira || null,
            address: newCompanyAddress || null,
            status: 'pending', // Awaiting administrator approval
            allowed_modules: ['controller', 'tech_ops', 'fleet_management', 'guard_monitoring', 'gate_access', 'attendance', 'analytics', 'archives']
          })
        });

        if (!companyRes.ok) {
          const errData = await companyRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to submit company onboarding request.');
        }

        const newCompanyObj = await companyRes.json();
        targetCompanyId = newCompanyObj.id;
      } catch (err: any) {
        addToast(`Company registration request failed: ${err.message}`, 'error');
        setLoading(false);
        return;
      }
    }

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
                company_id: targetCompanyId,
                role: isOnboardNewCompany ? UserRole.ADMIN : role,
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
        if (isOnboardNewCompany) {
            addToast('Success! Your company and account onboarding request has been submitted to Rapid Responders SA for approval.', 'success');
        } else {
            addToast('Success! Please verify your email. Your account is now pending administrator approval.', 'success');
        }
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
         {/* Joining type selector tabs */}
         <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-2xl mb-2">
             <button
                 type="button"
                 onClick={() => setIsOnboardNewCompany(false)}
                 className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                     !isOnboardNewCompany
                         ? 'bg-white dark:bg-gray-800 text-slate-900 dark:text-white shadow-md shadow-slate-200/50 dark:shadow-none'
                         : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                 }`}
             >
                 Join Approved Company
             </button>
             <button
                 type="button"
                 onClick={() => setIsOnboardNewCompany(true)}
                 className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                     isOnboardNewCompany
                         ? 'bg-white dark:bg-gray-800 text-slate-900 dark:text-white shadow-md shadow-slate-200/50 dark:shadow-none'
                         : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                 }`}
             >
                 🏢 Onboard New Company
             </button>
         </div>

         {isOnboardNewCompany ? (
             <div className="space-y-4 border border-blue-500/10 dark:border-blue-500/20 bg-blue-500/5 p-4 rounded-2xl mb-2">
                 <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">🏢 Company Onboarding Details</h3>
                 
                 <div>
                     <label htmlFor="new_company_name" className={labelClasses}>Company Name <span className="text-red-500">*</span></label>
                     <div className={inputContainerClasses}>
                         <div className={iconClasses}><BuildingIcon className="w-5 h-5 text-gray-400" /></div>
                         <input
                             id="new_company_name"
                             type="text"
                             required
                             value={newCompanyName}
                             onChange={(e) => setNewCompanyName(e.target.value)}
                             className={inputClasses}
                             placeholder="e.g. Paramount Patrols"
                         />
                     </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                         <label htmlFor="new_company_contact" className={labelClasses}>Contact Person <span className="text-red-500">*</span></label>
                         <input
                             id="new_company_contact"
                             type="text"
                             required
                             value={newCompanyContactPerson}
                             onChange={(e) => setNewCompanyContactPerson(e.target.value)}
                             className={`${inputClasses} pl-3`}
                             placeholder="Full Name"
                         />
                     </div>
                     <div>
                         <label htmlFor="new_company_cell" className={labelClasses}>Contact Cell <span className="text-red-500">*</span></label>
                         <input
                             id="new_company_cell"
                             type="tel"
                             required
                             value={newCompanyCellNumber}
                             onChange={(e) => setNewCompanyCellNumber(e.target.value)}
                             className={`${inputClasses} pl-3`}
                             placeholder="0821234567"
                         />
                     </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                         <label htmlFor="new_company_psira" className={labelClasses}>PSIRA No (Optional)</label>
                         <input
                             id="new_company_psira"
                             type="text"
                             value={newCompanyPsira}
                             onChange={(e) => setNewCompanyPsira(e.target.value.toUpperCase())}
                             className={`${inputClasses} pl-3`}
                             placeholder="PSIRA #"
                         />
                     </div>
                     <div>
                         <label htmlFor="new_company_address" className={labelClasses}>Address (Optional)</label>
                         <input
                             id="new_company_address"
                             type="text"
                             value={newCompanyAddress}
                             onChange={(e) => setNewCompanyAddress(e.target.value)}
                             className={`${inputClasses} pl-3`}
                             placeholder="123 Office Rd"
                         />
                     </div>
                 </div>
             </div>
         ) : (
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
                             {actualCompanies.map(company => (
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
         )}
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