import React, { useState, useMemo } from 'react';
import { Profile } from '../types';
import { supabase } from '../utils/supabase';
import { UserIcon, LockIcon, UploadCloudIcon } from '../components/icons';
import { useToast } from '../contexts/ToastContext';
import { useFormPersistence } from '../useFormPersistence';

interface ProfilePageProps {
  profile: Profile;
  setProfile: (profile: Profile) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ profile, setProfile }) => {
    
    const initialData = useMemo(() => ({
        first_name: profile.first_name || '',
        surname: profile.surname || '',
        cell: profile.cell || '',
        vehicle_reg: profile.vehicle_reg || '',
        home_address: profile.home_address || '',
        ice_no: profile.ice_no || '',
        medical_aid: profile.medical_aid || '',
        psira_number: profile.psira_number || '',
    }), [profile]);

    const [formData, setFormData] = useState<Partial<Profile>>(initialData);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null);
    
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingPassword, setLoadingPassword] = useState(false);
    const { addToast } = useToast();

    const formId = `profile-edit-${profile.id}`;

    const { clearDraft } = useFormPersistence(formId, {
        formData,
        setFormData,
        initialData,
        isEnabled: true,
    });


    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };
    
    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingProfile(true);

        let avatarUrlToUpdate = profile.avatar_url;

        if (!avatarUrlToUpdate && !avatarFile) {
            addToast('A profile selfie is required. Please upload one.', 'error');
            setLoadingProfile(false);
            return;
        }

        if (avatarFile) {
            const fileExt = avatarFile.name.split('.').pop();
            const filePath = `${profile.id}/avatar.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });

            if (uploadError) {
                addToast('Error uploading selfie: ' + uploadError.message, 'error');
                setLoadingProfile(false);
                return;
            }
            
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            avatarUrlToUpdate = `${urlData.publicUrl}?t=${new Date().getTime()}`;
        }
        
        const { data: updatedProfile, error: profileError } = await supabase
            .from('profiles')
            .update({ ...formData, avatar_url: avatarUrlToUpdate })
            .eq('id', profile.id)
            .select()
            .single();
        
        if (profileError) {
            addToast('Error updating profile: ' + profileError.message, 'error');
        } else if (updatedProfile) {
            setProfile(updatedProfile);
            setAvatarPreview(updatedProfile.avatar_url);
            addToast('Profile updated successfully!', 'success');
            setAvatarFile(null);
            clearDraft();
        }
        
        setLoadingProfile(false);
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            addToast('Passwords do not match.', 'error');
            return;
        }
        if (password.length < 6) {
            addToast('Password must be at least 6 characters long.', 'error');
            return;
        }

        setLoadingPassword(true);
        // @ts-ignore
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            addToast('Error updating password: ' + error.message, 'error');
        } else {
            addToast('Password updated successfully!', 'success');
            setPassword('');
            setConfirmPassword('');
        }
        setLoadingPassword(false);
    };

    const cardClasses = "bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 backdrop-blur-lg shadow-lg dark:shadow-none";
    const inputClasses = "mt-1 w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    const buttonClasses = "w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:scale-105 transition-transform duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="container mx-auto">
             <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3"><UserIcon className="w-8 h-8"/> My Profile</h2>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-3 space-y-8">
                    {/* Profile Form */}
                    <div className={cardClasses}>
                         <h3 className="text-xl font-bold mb-4">Profile Information</h3>
                         <form onSubmit={handleProfileUpdate} className="space-y-4">
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
                                    <label htmlFor="avatar-upload" className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                        <UploadCloudIcon className="w-5 h-5"/>
                                        <span>Change Selfie</span>
                                    </label>
                                    <input id="avatar-upload" name="avatar-upload" type="file" className="sr-only" accept="image/*" capture="user" onChange={handleAvatarChange} />
                                </div>
                                {!avatarPreview && <p className="text-xs text-red-500 dark:text-red-400 mt-1">A profile selfie is required to save changes.</p>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="first_name" className={labelClasses}>First Name</label>
                                    <input id="first_name" name="first_name" type="text" value={formData.first_name} onChange={handleFormChange} required className={inputClasses} />
                                </div>
                                <div>
                                    <label htmlFor="surname" className={labelClasses}>Surname</label>
                                    <input id="surname" name="surname" type="text" value={formData.surname} onChange={handleFormChange} required className={inputClasses} />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="email_display" className={labelClasses}>Email</label>
                                <input id="email_display" type="email" value={profile.email} disabled className={`${inputClasses} opacity-60 cursor-not-allowed`} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="cell" className={labelClasses}>Cell Number</label>
                                    <input id="cell" name="cell" type="tel" value={formData.cell} onChange={handleFormChange} required className={inputClasses} />
                                </div>
                                <div>
                                    <label htmlFor="ice_no" className={labelClasses}>ICE Number</label>
                                    <input id="ice_no" name="ice_no" type="tel" value={formData.ice_no} onChange={handleFormChange} required className={inputClasses} />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="home_address" className={labelClasses}>Home Address</label>
                                <input id="home_address" name="home_address" type="text" value={formData.home_address} onChange={handleFormChange} required className={inputClasses} />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="vehicle_reg" className={labelClasses}>Vehicle Reg (N/A if none)</label>
                                    <input id="vehicle_reg" name="vehicle_reg" type="text" value={formData.vehicle_reg} onChange={handleFormChange} className={inputClasses} />
                                </div>
                                <div>
                                    <label htmlFor="medical_aid" className={labelClasses}>Medical Aid (N/A if none)</label>
                                    <input id="medical_aid" name="medical_aid" type="text" value={formData.medical_aid} onChange={handleFormChange} className={inputClasses} />
                                </div>
                            </div>
                             <div>
                                <label htmlFor="psira_number" className={labelClasses}>PSIRA Number (Optional)</label>
                                <input id="psira_number" name="psira_number" type="text" value={formData.psira_number} onChange={handleFormChange} className={inputClasses} />
                            </div>
                            <div className="pt-2">
                                <button type="submit" disabled={loadingProfile} className={buttonClasses}>
                                    {loadingProfile ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Update Profile'}
                                </button>
                            </div>
                         </form>
                    </div>

                    {/* Password Form */}
                    <div className={cardClasses}>
                        <h3 className="text-xl font-bold mb-4">Change Password</h3>
                        <form onSubmit={handlePasswordUpdate} className="space-y-4">
                            <div>
                                <label htmlFor="password" className={labelClasses}>New Password</label>
                                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClasses} placeholder="••••••••" />
                            </div>
                             <div>
                                <label htmlFor="confirm_password" className={labelClasses}>Confirm New Password</label>
                                <input id="confirm_password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClasses} placeholder="••••••••" />
                            </div>
                             <div className="pt-2">
                                <button type="submit" disabled={loadingPassword} className={buttonClasses}>
                                    {loadingPassword ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
             </div>
        </div>
    );
};

export default ProfilePage;
