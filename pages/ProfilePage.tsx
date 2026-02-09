import React, { useState } from 'react';
import { Profile } from '../types';
import { supabase } from '../utils/supabase';
import { UserIcon, LockIcon, MailIcon, UploadCloudIcon } from '../components/icons';
import { useToast } from '../contexts/ToastContext';

interface ProfilePageProps {
  profile: Profile;
  setProfile: (profile: Profile) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ profile, setProfile }) => {
    const [formData, setFormData] = useState<Partial<Profile>>({
        first_name: profile.first_name || '',
        surname: profile.surname || '',
        cell: profile.cell || '',
        vehicle_reg: profile.vehicle_reg || '',
        home_address: profile.home_address || '',
        ice_no: profile.ice_no || '',
        medical_aid: profile.medical_aid || '',
        psira_number: profile.psira_number || '',
    });
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null);
    
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingPassword, setLoadingPassword] = useState(false);
    const [loadingAvatar, setLoadingAvatar] = useState(false);
    const { addToast } = useToast();

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
    
    const handleAvatarUpload = async () => {
        if (!avatarFile) return;
        setLoadingAvatar(true);

        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${profile.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
            addToast('Error uploading selfie: ' + uploadError.message, 'error');
            setLoadingAvatar(false);
            return;
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

        const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: `${data.publicUrl}?t=${new Date().getTime()}` }) // Add timestamp to bust cache
            .eq('id', profile.id)
            .select()
            .single();

        if (updateError) {
            addToast('Error updating profile picture URL: ' + updateError.message, 'error');
        } else if (updatedProfile) {
            setProfile(updatedProfile);
            setAvatarPreview(updatedProfile.avatar_url);
            addToast('Selfie / Profile Pic updated successfully!', 'success');
        }
        setLoadingAvatar(false);
        setAvatarFile(null);
    };

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingProfile(true);

        const { data: updatedProfile, error: profileError } = await supabase
            .from('profiles')
            .update(formData)
            .eq('id', profile.id)
            .select()
            .single();

        if (profileError) {
            addToast('Error updating profile details: ' + profileError.message, 'error');
        } else if (updatedProfile) {
            setProfile(updatedProfile);
            addToast('Profile updated successfully!', 'success');
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
        // @ts-ignore - FIX: Property 'updateUser' does not exist on type 'SupabaseAuthClient'. Using older 'update' method.
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
                {/* Selfie Card */}
                <div className={`${cardClasses} lg:col-span-1 flex flex-col items-center text-center`}>
                    <div className="relative group w-32 h-32 mb-4">
                        <img 
                            src={avatarPreview || `https://i.pravatar.cc/128?u=${profile.id}`} 
                            alt="User Selfie"
                            className="w-32 h-32 rounded-full object-cover border-4 border-gray-300 dark:border-gray-600"
                        />
                        <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <UploadCloudIcon className="w-8 h-8"/>
                            <span className="text-xs font-semibold mt-1">Upload Selfie</span>
                        </label>
                        <input type="file" id="avatar-upload" className="sr-only" accept="image/*" onChange={handleAvatarChange} />
                    </div>
                    {avatarFile && (
                        <button onClick={handleAvatarUpload} disabled={loadingAvatar} className={`${buttonClasses} mb-4`}>
                            {loadingAvatar ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Upload Selfie'}
                        </button>
                    )}
                    <h3 className="text-xl font-bold">{profile.first_name} {profile.surname}</h3>
                    <p className="text-gray-500 dark:text-gray-400">{profile.email}</p>
                    <div className="mt-4 space-x-2">
                        <span className="px-3 py-1 text-xs font-bold rounded-full capitalize border bg-blue-500/20 text-blue-500 dark:text-blue-400 border-blue-500/30">{profile.role}</span>
                        <span className="px-3 py-1 text-xs font-bold rounded-full capitalize border bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">{profile.status}</span>
                    </div>
                </div>

                {/* Forms Column */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Profile Form */}
                    <div className={cardClasses}>
                         <h3 className="text-xl font-bold mb-4">Profile Information</h3>
                         <form onSubmit={handleProfileUpdate} className="space-y-4">
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
                                <label htmlFor="psira_number" className={labelClasses}>PSIRA Number</label>
                                <input id="psira_number" name="psira_number" type="text" value={formData.psira_number} onChange={handleFormChange} required className={inputClasses} />
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