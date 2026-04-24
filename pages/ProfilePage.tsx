import React, { useState, useMemo } from 'react';
import { Profile, UserRole, UserStatus } from '../types';
import { supabase } from '../utils/supabase';
import { UserIcon, LockIcon, UploadCloudIcon } from '../components/icons';
import { useToast } from '../contexts/ToastContext';
import { useFormPersistence } from '../useFormPersistence';

interface ProfilePageProps {
  profile: Profile;
  setProfile: (profile: Profile) => void;
  onCancel?: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ profile, setProfile, onCancel }) => {
    
    const initialData = useMemo(() => ({
        first_name: profile.first_name || '',
        surname: profile.surname || '',
        cell: profile.cell || '',
        vehicle_reg: profile.vehicle_reg || '',
        home_address: profile.home_address || '',
        work_address: profile.work_address || '',
        ice_no: profile.ice_no || '',
        medical_aid: profile.medical_aid || '',
        medical_aid_policy_number: profile.medical_aid_policy_number || '',
        allergies: profile.allergies || '',
        insurance_company: profile.insurance_company || '',
        insurance_policy_number: profile.insurance_policy_number || '',
        insurance_type: profile.insurance_type || '',
        insurance_contact: profile.insurance_contact || '',
        vehicles: profile.vehicles || [],
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


    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const fieldsToUppercase = ['vehicle_reg', 'psira_number'];
        const processedValue = fieldsToUppercase.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };

    const handleVehicleChange = (index: number, field: string, value: string) => {
        setFormData(prev => {
            const newVehicles = [...(prev.vehicles || [])];
            newVehicles[index] = { ...newVehicles[index], [field]: value };
            return { ...prev, vehicles: newVehicles };
        });
    };

    const addVehicle = () => {
        setFormData(prev => ({
            ...prev,
            vehicles: [...(prev.vehicles || []), { make: '', model: '', reg: '', vin: '', engine_no: '', tracking_co: '', tracking_co_contact: '' }]
        }));
    };

    const removeVehicle = (index: number) => {
        setFormData(prev => {
            const newVehicles = [...(prev.vehicles || [])];
            newVehicles.splice(index, 1);
            return { ...prev, vehicles: newVehicles };
        });
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
        
        if ((profile.role === UserRole.CONTROLLER || profile.role === UserRole.RESPONDER) && (!formData.vehicles || formData.vehicles.length === 0)) {
            addToast('Please add at least one vehicle.', 'error');
            return;
        }

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
        
        try {
            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: profile.id, ...formData, avatar_url: avatarUrlToUpdate })
            });

            const contentType = response.headers.get('content-type');
            let result;
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                const text = await response.text();
                console.error('Non-JSON response received from /api/update-profile:', text);
                throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
            }

            if (!response.ok) {
                throw new Error(result?.error || `Failed to update profile (Status: ${response.status})`);
            }

            if (result) {
                setProfile(result);
                setAvatarPreview(result.avatar_url);
                addToast('Profile updated successfully!', 'success');
                setAvatarFile(null);
                clearDraft();
            }
        } catch (error: any) {
            addToast('Error updating profile: ' + (error.message || 'Network error'), 'error');
            console.error("Profile update error:", error);
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
        // FIX: Using bracket notation to bypass potential SupabaseAuthClient type errors.
        const { error } = await supabase.auth['updateUser']({ password });
        if (error) {
            addToast('Error updating password: ' + error.message, 'error');
        } else {
            addToast('Password updated successfully!', 'success');
            setPassword('');
            setConfirmPassword('');
        }
        setLoadingPassword(false);
    };

    const isComplete = useMemo(() => {
        if (profile.role !== UserRole.CONTROLLER && profile.role !== UserRole.RESPONDER) return true;
        if (profile.status !== UserStatus.ACTIVE) return true;
        
        return !!(
            profile.first_name &&
            profile.surname &&
            profile.home_address &&
            profile.work_address &&
            profile.cell &&
            profile.ice_no &&
            profile.medical_aid &&
            profile.medical_aid_policy_number &&
            profile.allergies &&
            profile.insurance_company &&
            profile.insurance_policy_number &&
            profile.insurance_type &&
            profile.insurance_contact &&
            profile.vehicles && profile.vehicles.length > 0
        );
    }, [profile]);

    const cardClasses = "bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 backdrop-blur-lg shadow-lg dark:shadow-none";
    const inputClasses = "mt-1 w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    const buttonClasses = "w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:scale-105 transition-transform duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="container mx-auto">
             {!isComplete && (
                 <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg shadow-sm">
                     <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-1">Profile Incomplete</h3>
                     <p className="text-sm text-yellow-700 dark:text-yellow-400">
                         As an approved {profile.role}, you must complete all required details including Work Address, Medical Details, Insurance Details, and at least one Vehicle before you can access the rest of the system.
                     </p>
                 </div>
             )}
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
                            {(profile.role === UserRole.CONTROLLER || profile.role === UserRole.RESPONDER) && (
                                <div>
                                    <label htmlFor="work_address" className={labelClasses}>Work Address</label>
                                    <input id="work_address" name="work_address" type="text" value={formData.work_address} onChange={handleFormChange} required className={inputClasses} />
                                </div>
                            )}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="vehicle_reg" className={labelClasses}>Vehicle Reg (N/A if none)</label>
                                    <input id="vehicle_reg" name="vehicle_reg" type="text" value={formData.vehicle_reg} onChange={handleFormChange} className={inputClasses} />
                                </div>
                                <div>
                                    <label htmlFor="medical_aid" className={labelClasses}>Medical Aid Name (N/A if none)</label>
                                    <input id="medical_aid" name="medical_aid" type="text" value={formData.medical_aid} onChange={handleFormChange} required={profile.role === UserRole.CONTROLLER || profile.role === UserRole.RESPONDER} className={inputClasses} />
                                </div>
                            </div>
                            {(profile.role === UserRole.CONTROLLER || profile.role === UserRole.RESPONDER) && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="medical_aid_policy_number" className={labelClasses}>Medical Aid Policy Number</label>
                                            <input id="medical_aid_policy_number" name="medical_aid_policy_number" type="text" value={formData.medical_aid_policy_number} onChange={handleFormChange} required className={inputClasses} />
                                        </div>
                                        <div>
                                            <label htmlFor="allergies" className={labelClasses}>Please Stipulate Any Allergies</label>
                                            <input id="allergies" name="allergies" type="text" value={formData.allergies} onChange={handleFormChange} required className={inputClasses} />
                                        </div>
                                    </div>
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                                        <h4 className="text-lg font-semibold mb-3">Insurance Company Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="insurance_company" className={labelClasses}>Company Name</label>
                                                <input id="insurance_company" name="insurance_company" type="text" value={formData.insurance_company} onChange={handleFormChange} required className={inputClasses} />
                                            </div>
                                            <div>
                                                <label htmlFor="insurance_policy_number" className={labelClasses}>Policy Number</label>
                                                <input id="insurance_policy_number" name="insurance_policy_number" type="text" value={formData.insurance_policy_number} onChange={handleFormChange} required className={inputClasses} />
                                            </div>
                                            <div>
                                                <label htmlFor="insurance_type" className={labelClasses}>Type Of Insurance</label>
                                                <input id="insurance_type" name="insurance_type" type="text" value={formData.insurance_type} onChange={handleFormChange} required className={inputClasses} />
                                            </div>
                                            <div>
                                                <label htmlFor="insurance_contact" className={labelClasses}>Contact Details</label>
                                                <input id="insurance_contact" name="insurance_contact" type="text" value={formData.insurance_contact} onChange={handleFormChange} required className={inputClasses} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-lg font-semibold">Vehicle Details</h4>
                                            <button type="button" onClick={addVehicle} className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition">
                                                + Add Vehicle
                                            </button>
                                        </div>
                                        {formData.vehicles?.length === 0 && (
                                            <p className="text-sm text-red-500 mb-2">Please add at least one vehicle.</p>
                                        )}
                                        {formData.vehicles?.map((vehicle, index) => (
                                            <div key={index} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-700 relative">
                                                <button type="button" onClick={() => removeVehicle(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                                                    &times; Remove
                                                </button>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className={labelClasses}>Make</label>
                                                        <input type="text" value={vehicle.make} onChange={(e) => handleVehicleChange(index, 'make', e.target.value)} required className={inputClasses} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClasses}>Model</label>
                                                        <input type="text" value={vehicle.model} onChange={(e) => handleVehicleChange(index, 'model', e.target.value)} required className={inputClasses} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClasses}>Reg</label>
                                                        <input type="text" value={vehicle.reg} onChange={(e) => handleVehicleChange(index, 'reg', e.target.value)} required className={inputClasses} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClasses}>Chassis No (Vin)</label>
                                                        <input type="text" value={vehicle.vin} onChange={(e) => handleVehicleChange(index, 'vin', e.target.value)} required className={inputClasses} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClasses}>Engine No</label>
                                                        <input type="text" value={vehicle.engine_no} onChange={(e) => handleVehicleChange(index, 'engine_no', e.target.value)} required className={inputClasses} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClasses}>Tracking Co</label>
                                                        <input type="text" value={vehicle.tracking_co} onChange={(e) => handleVehicleChange(index, 'tracking_co', e.target.value)} required className={inputClasses} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClasses}>Tracking Co Contact</label>
                                                        <input type="text" value={vehicle.tracking_co_contact} onChange={(e) => handleVehicleChange(index, 'tracking_co_contact', e.target.value)} required className={inputClasses} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(!formData.vehicles || formData.vehicles.length === 0) && (
                                            <p className="text-sm text-gray-500 italic">No vehicles added.</p>
                                        )}
                                    </div>
                                </>
                            )}
                             <div>
                                <label htmlFor="psira_number" className={labelClasses}>PSIRA Number (Optional)</label>
                                <input id="psira_number" name="psira_number" type="text" value={formData.psira_number} onChange={handleFormChange} className={inputClasses} />
                            </div>
                            <div className="pt-2 flex gap-4">
                                <button type="submit" disabled={loadingProfile} className={buttonClasses}>
                                    {loadingProfile ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Update Profile'}
                                </button>
                                {onCancel && (
                                    <button 
                                        type="button" 
                                        onClick={onCancel}
                                        className="w-full flex justify-center py-2.5 px-4 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Exit without Saving
                                    </button>
                                )}
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