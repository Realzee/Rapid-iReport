

import React, { useState, useEffect, useMemo } from 'react';
import { PlusIcon, BuildingIcon, UploadCloudIcon, MegaphoneIcon, EditIcon, TrashIcon, AlertTriangleIcon, LightbulbIcon, DatabaseIcon } from '../components/icons';
import { Company, Profile, UserRole, Announcement, AnnouncementType } from '../types';
import CompanyManagementTable from '../components/CompanyManagementTable';
import AddEditCompanyModal from '../components/AddEditCompanyModal';
import DeleteCompanyModal from '../components/DeleteCompanyModal';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import AddEditAnnouncementModal from '../components/AddEditAnnouncementModal';
import ConfirmModal from '../components/ConfirmModal';
import DatabaseBackupModal from '../components/DatabaseBackupModal';
import { safeFormat } from '../utils/dateUtils';
import CompanyDetailModal from '../components/CompanyDetailModal';
import { TacticalSkeleton } from '../components/TacticalSkeleton';
import { invalidateCompaniesCache } from '../utils/cacheUtils';

const AnnouncementTypeIcon: React.FC<{ type: AnnouncementType, className?: string }> = ({ type, className="w-6 h-6" }) => {
    switch (type) {
        case AnnouncementType.ALERT: return <AlertTriangleIcon className={`${className} text-red-500`} />;
        case AnnouncementType.NOTICE: return <MegaphoneIcon className={`${className} text-blue-500`} />;
        case AnnouncementType.SAFETY_TIP: return <LightbulbIcon className={`${className} text-yellow-500`} />;
        default: return <MegaphoneIcon className={`${className} text-gray-500`} />;
    }
};

interface CompaniesPageProps {
    profile?: Profile;
    setProfile?: (profile: Profile) => void;
}

const CompaniesPage: React.FC<CompaniesPageProps> = ({ profile, setProfile }) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [viewCompany, setViewCompany] = useState<Company | null>(null);
    const { addToast } = useToast();
    const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(profile || null);

    // Global Branding states
    const { mainLogoUrl, setMainLogoUrl, defaultLogoUrl, faviconUrl, setFaviconUrl, defaultFaviconUrl } = useSettings();
    const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string>(mainLogoUrl);
    const [isUploadingGlobalLogo, setIsUploadingGlobalLogo] = useState(false);
    
    const [newFaviconFile, setNewFaviconFile] = useState<File | null>(null);
    const [faviconPreview, setFaviconPreview] = useState<string>(faviconUrl);
    const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);

    // Announcements states
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
    const [announcementToEdit, setAnnouncementToEdit] = useState<Announcement | null>(null);
    const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
    
    // Backup Modal State
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [isSavingCompany, setIsSavingCompany] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const dbHost = useMemo(() => {
        const supabaseUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
        try {
            const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
            if (projectRef) {
                return `db.${projectRef}.supabase.co`;
            }
        } catch {}
        return 'db.<your-project-ref>.supabase.co';
    }, []);


    useEffect(() => {
        if (profile) {
            setCurrentUserProfile(profile);
        } else {
            const fetchCurrentUserProfile = async () => {
                // FIX: Using bracket notation to bypass potential SupabaseAuthClient type errors.
                const { data: { session } } = await supabase.auth['getSession']();
                if (session?.user) {
                    const { data: profileData, error } = await supabase.from('profiles').select('*, company:companies(*)').eq('id', session.user.id).single();
                    if (error) {
                        addToast(`Error fetching your profile: ${error.message}`, 'error');
                        setLoading(false);
                    } else {
                        setCurrentUserProfile(profileData);
                    }
                } else {
                    setLoading(false);
                }
            };
            fetchCurrentUserProfile();
        }
    }, [profile, addToast]);

    useEffect(() => {
        setLogoPreview(mainLogoUrl);
    }, [mainLogoUrl]);
    
    useEffect(() => {
        setFaviconPreview(faviconUrl);
    }, [faviconUrl]);


    useEffect(() => {
        if (!currentUserProfile) return;

        const fetchData = async () => {
            setLoading(true);

            const canManageAll = [UserRole.ADMIN].includes(currentUserProfile.role);

            const companiesQuery = supabase.from('companies').select('*').order('name').limit(100);
            if (!canManageAll && currentUserProfile.company_id) {
                companiesQuery.eq('id', currentUserProfile.company_id);
            }

            const usersQuery = supabase.from('profiles').select('id, first_name, surname, email, role, status, avatar_url, company_id').order('first_name').limit(200);
            if (!canManageAll && currentUserProfile.company_id) {
                usersQuery.eq('company_id', currentUserProfile.company_id);
            }
            
            const announcementsQuery = supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(20);

            const [
                { data: companiesData, error: cError },
                { data: usersData, error: uError },
                { data: announcementsData, error: aError }
            ] = await Promise.all([companiesQuery, usersQuery, announcementsQuery]);
            
            if (cError) {
                if (cError.message?.includes('exceed_egress_quota')) {
                    console.warn('Supabase egress quota limit reached on companies query.');
                } else {
                    console.error('Error fetching companies:', cError);
                }
            } else {
                setCompanies(companiesData || []);
            }
            
            if (uError) {
                if (!uError.message?.includes('exceed_egress_quota')) {
                    console.error('Error fetching users:', uError);
                }
            } else {
                setUsers(usersData || []);
            }
            
            if (aError) {
                if (!aError.message?.includes('exceed_egress_quota')) {
                    console.error("Error fetching announcements:", aError);
                }
            } else {
                setAnnouncements(announcementsData || []);
            }

            setLoading(false);
        };
        fetchData();
    }, [currentUserProfile]);

    const handleAddCompany = () => {
        setSelectedCompany(null);
        setIsAddEditModalOpen(true);
    };

    const handleEditCompany = (company: Company) => {
        setSelectedCompany(company);
        setIsAddEditModalOpen(true);
    };

    const handleDeleteCompany = (company: Company) => {
        setSelectedCompany(company);
        setIsDeleteModalOpen(true);
    };

    const handleViewCompany = (company: Company) => {
        setViewCompany(company);
    };

    const handleSaveCompany = async (companyData: Partial<Company>, logoFile: File | null, boloBgFile: File | null) => {
        setIsSavingCompany(true);
        let finalLogoUrl = companyData.logo_url;
        let finalBoloBgUrl = companyData.bolo_background_url;

        try {
            const companyId = companyData.id || crypto.randomUUID();
            const dataToSave = { ...companyData, id: companyId };

            if (logoFile) {
                const fileExt = logoFile.name.split('.').pop();
                const filePath = `${companyId}/logo.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('company-logos')
                    .upload(filePath, logoFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(filePath);
                finalLogoUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            }

            if (boloBgFile) {
                const fileExt = boloBgFile.name.split('.').pop();
                const filePath = `${companyId}/bolo_background.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('company-logos')
                    .upload(filePath, boloBgFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(filePath);
                finalBoloBgUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            }

            let savedCompany: Company | null = null;
            
            const response = await fetch('/api/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...dataToSave, 
                    logo_url: finalLogoUrl,
                    bolo_background_url: finalBoloBgUrl
                })
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Unknown error');
                } else {
                    const errorText = await response.text();
                    console.error("Non-JSON error response:", errorText);
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
            }

            savedCompany = await response.json();
            
            if (savedCompany) {
                invalidateCompaniesCache();
                if (companyData.id) {
                    setCompanies(companies.map(c => c.id === savedCompany!.id ? savedCompany! : c));
                } else {
                    setCompanies([...companies, savedCompany]);
                }
                
                // If this is our own company, update the profile context and the local current user state
                if (profile && setProfile && savedCompany.id === profile.company_id) {
                    setProfile({
                        ...profile,
                        company: savedCompany
                    });
                }
                
                if (currentUserProfile && savedCompany.id === currentUserProfile.company_id) {
                    setCurrentUserProfile(prev => prev ? {
                        ...prev,
                        company: savedCompany
                    } : null);
                }

                addToast(`Company '${savedCompany.name}' saved successfully.`, 'success');
                setIsAddEditModalOpen(false);
            }
        } catch (error: any) {
            console.error('Error saving company:', error);
            const errorMessage = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            addToast('Error saving company: ' + errorMessage, 'error');
        } finally {
            setIsSavingCompany(false);
        }
    };

    const confirmDeleteCompany = async () => {
        if (selectedCompany) {
            try {
                if (selectedCompany.logo_url) {
                    const urlParts = selectedCompany.logo_url.split('/');
                    const filePath = urlParts.slice(urlParts.indexOf('company-logos') + 1).join('/');
                    const [folder, file] = filePath.split('?')[0].split('/');
                    if (folder && file) {
                        await supabase.storage.from('company-logos').remove([`${folder}/${file}`]);
                    }
                }

                const response = await fetch('/api/companies', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: selectedCompany.id })
                });

                if (!response.ok) {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Unknown error');
                    } else {
                        const errorText = await response.text();
                        console.error("Non-JSON error response:", errorText);
                        throw new Error(`Server error: ${response.status} ${response.statusText}`);
                    }
                }
                
                invalidateCompaniesCache();
                addToast(`Company '${selectedCompany.name}' deleted successfully.`, 'success');
                setCompanies(companies.filter(c => c.id !== selectedCompany.id));
            } catch (error: any) {
                 addToast('Error deleting company: ' + error.message, 'error');
            }
        }
        setIsDeleteModalOpen(false);
        setSelectedCompany(null);
    };

    // Global Branding Functions
    const handleGlobalLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSaveGlobalLogo = async () => {
        if (!newLogoFile) return;
        setIsUploadingGlobalLogo(true);
        try {
            const fileExt = newLogoFile.name.split('.').pop();
            const filePath = `main-logo.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('app-assets')
                .upload(filePath, newLogoFile, { upsert: true, cacheControl: '0' });
            
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(filePath);
            const newUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

            const response = await fetch('/api/update-setting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'main_logo_url', value: newUrl })
            });
            
            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Unknown error');
                } else {
                    const errorText = await response.text();
                    console.error("Non-JSON error response:", errorText);
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
            }

            setMainLogoUrl(newUrl);
            setNewLogoFile(null);
            addToast('Main application logo updated successfully.', 'success');

        } catch (error: any) {
            addToast('Error updating main logo: ' + error.message, 'error');
        } finally {
            setIsUploadingGlobalLogo(false);
        }
    };

    const handleResetGlobalLogo = () => {
        setConfirmAction({
            title: 'Reset Global Logo',
            message: 'Are you sure you want to reset the global application logo to the default value?',
            onConfirm: async () => {
                setIsUploadingGlobalLogo(true);
                try {
                    const response = await fetch('/api/update-setting', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: 'main_logo_url', value: null })
                    });
                    
                    if (!response.ok) {
                        const contentType = response.headers.get("content-type");
                        if (contentType && contentType.indexOf("application/json") !== -1) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Unknown error');
                        } else {
                            const errorText = await response.text();
                            console.error("Non-JSON error response:", errorText);
                            throw new Error(`Server error: ${response.status} ${response.statusText}`);
                        }
                    }

                    setMainLogoUrl(defaultLogoUrl);
                    setLogoPreview(defaultLogoUrl);
                    setNewLogoFile(null);
                    addToast('Main logo reset to default.', 'info');
                } catch (error: any) {
                     addToast('Error resetting logo: ' + error.message, 'error');
                } finally {
                    setIsUploadingGlobalLogo(false);
                }
            }
        });
    };
    
    const handleFaviconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!['image/png', 'image/svg+xml', 'image/x-icon', 'image/jpeg'].includes(file.type)) {
                addToast('Invalid file type. Please upload a PNG, SVG, ICO, or JPG.', 'error');
                return;
            }
            setNewFaviconFile(file);
            setFaviconPreview(URL.createObjectURL(file));
        }
    };

    const handleSaveFavicon = async () => {
        if (!newFaviconFile) return;
        setIsUploadingFavicon(true);
        try {
            const fileExt = newFaviconFile.name.split('.').pop();
            const filePath = `favicon.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('app-assets')
                .upload(filePath, newFaviconFile, { upsert: true, cacheControl: '0' });
            
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(filePath);
            const newUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

            const response = await fetch('/api/update-setting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'favicon_url', value: newUrl })
            });
            
            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Unknown error');
                } else {
                    const errorText = await response.text();
                    console.error("Non-JSON error response:", errorText);
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
            }

            setFaviconUrl(newUrl);
            setNewFaviconFile(null);
            addToast('App icon updated successfully.', 'success');
        } catch (error: any) {
            addToast('Error updating app icon: ' + error.message, 'error');
        } finally {
            setIsUploadingFavicon(false);
        }
    };

    const handleResetFavicon = () => {
        setConfirmAction({
            title: 'Reset App Icon',
            message: 'Are you sure you want to reset the application icon to the default value?',
            onConfirm: async () => {
                setIsUploadingFavicon(true);
                try {
                    const response = await fetch('/api/update-setting', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: 'favicon_url', value: null })
                    });
                    
                    if (!response.ok) {
                        const contentType = response.headers.get("content-type");
                        if (contentType && contentType.indexOf("application/json") !== -1) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Unknown error');
                        } else {
                            const errorText = await response.text();
                            console.error("Non-JSON error response:", errorText);
                            throw new Error(`Server error: ${response.status} ${response.statusText}`);
                        }
                    }

                    setFaviconUrl(defaultFaviconUrl);
                    setFaviconPreview(defaultFaviconUrl);
                    setNewFaviconFile(null);
                    addToast('App icon reset to default.', 'info');
                } catch (error: any) {
                     addToast('Error resetting app icon: ' + error.message, 'error');
                } finally {
                    setIsUploadingFavicon(false);
                }
            }
        });
    };
    
    // Announcement handlers
    const canManageSettings = currentUserProfile && [UserRole.ADMIN, UserRole.MODERATOR].includes(currentUserProfile.role);

    const handleAddAnnouncement = () => {
        setAnnouncementToEdit(null);
        setIsAnnouncementModalOpen(true);
    };

    const handleEditAnnouncement = (announcement: Announcement) => {
        setAnnouncementToEdit(announcement);
        setIsAnnouncementModalOpen(true);
    };

    const handleDeleteAnnouncement = (announcement: Announcement) => {
        setAnnouncementToDelete(announcement);
    };
    
    const handleSaveAnnouncement = async (announcementData: Partial<Announcement>, imageFile: File | null) => {
        let finalImageUrl = announcementData.image_url;

        try {
            // Case 1: A new file is being uploaded.
            if (imageFile) {
                // If editing and an old image existed, delete it first.
                if (announcementToEdit?.image_url) {
                    const urlParts = announcementToEdit.image_url.split('/app-assets/');
                    if (urlParts.length > 1) {
                        const filePath = urlParts[1].split('?')[0];
                        await supabase.storage.from('app-assets').remove([filePath]);
                    }
                }

                const announcementId = announcementData.id || crypto.randomUUID();
                const fileExt = imageFile.name.split('.').pop();
                const filePath = `announcements/${announcementId}/image-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('app-assets').upload(filePath, imageFile);
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(filePath);
                finalImageUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            } 
            // Case 2: The existing image was removed (no new file, and url is now missing).
            else if (!announcementData.image_url && announcementToEdit?.image_url) {
                const urlParts = announcementToEdit.image_url.split('/app-assets/');
                if (urlParts.length > 1) {
                    const filePath = urlParts[1].split('?')[0];
                    await supabase.storage.from('app-assets').remove([filePath]);
                }
                finalImageUrl = undefined;
            }

            const dbPayload = {
                title: announcementData.title,
                content: announcementData.content,
                type: announcementData.type,
                expires_at: announcementData.expires_at || null,
                image_url: finalImageUrl,
            };

            const response = await fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...dbPayload, id: announcementData.id })
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Unknown error');
                } else {
                    const errorText = await response.text();
                    console.error("Non-JSON error response:", errorText);
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
            }

            const savedAnnouncement = await response.json();
            
            if (savedAnnouncement) {
                setAnnouncements(prev => announcementData.id
                    ? prev.map(a => a.id === savedAnnouncement.id ? savedAnnouncement : a)
                    : [savedAnnouncement, ...prev].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                );
                addToast(`Announcement '${savedAnnouncement.title}' saved successfully.`, 'success');
            }
        } catch (error: any) {
            addToast('Error saving announcement: ' + error.message, 'error');
        } finally {
            setIsAnnouncementModalOpen(false);
            setAnnouncementToEdit(null);
        }
    };

    const confirmDeleteAnnouncement = async () => {
        if (announcementToDelete) {
            try {
                if (announcementToDelete.image_url) {
                    const pathParts = announcementToDelete.image_url.split('/app-assets/');
                    if (pathParts.length > 1) {
                        const filePath = pathParts[1].split('?')[0];
                        await supabase.storage.from('app-assets').remove([filePath]);
                    }
                }
                const response = await fetch('/api/announcements', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: announcementToDelete.id })
                });

                if (!response.ok) {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Unknown error');
                    } else {
                        const errorText = await response.text();
                        console.error("Non-JSON error response:", errorText);
                        throw new Error(`Server error: ${response.status} ${response.statusText}`);
                    }
                }

                addToast(`Announcement '${announcementToDelete.title}' deleted successfully.`, 'success');
                setAnnouncements(announcements.filter(a => a.id !== announcementToDelete.id));
            } catch (error: any) {
                 addToast('Error deleting announcement: ' + error.message, 'error');
            }
        }
        setAnnouncementToDelete(null);
    };


    return (
        <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-10 max-w-7xl">
            {currentUserProfile?.role === UserRole.ADMIN && (
                <div className="bg-white/80 dark:bg-gray-900/80 border border-gray-200/90 dark:border-gray-800 rounded-3xl p-4 sm:p-6 lg:p-8 backdrop-blur-xl shadow-xl space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-gray-950 p-1.5 border border-gray-700/60 shadow-inner flex items-center justify-center flex-shrink-0">
                                <img 
                                    src={mainLogoUrl || defaultLogoUrl} 
                                    alt="Main Logo" 
                                    className="max-w-full max-h-full object-contain" 
                                    onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} 
                                /> 
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                                    Global Settings & Branding
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                    Manage master branding, application logo, and browser favicon icons
                                </p>
                            </div>
                        </div>
                        <span className="self-start sm:self-center px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            System Control
                        </span>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Logo Section */}
                        <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span>Main Application Logo</span>
                                </h4>
                                <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-gray-200/70 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    PNG / SVG
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 min-w-0">
                                {/* Logo Preview */}
                                <div className="w-full sm:w-56 flex flex-col items-center sm:items-start flex-shrink-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5 text-center sm:text-left">
                                        Logo Preview
                                    </span>
                                    <div className="w-full h-32 bg-gray-950 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-800 dark:border-gray-700 p-3 shadow-inner overflow-hidden relative">
                                        <img 
                                            src={logoPreview || mainLogoUrl || defaultLogoUrl} 
                                            alt="Main Logo Preview" 
                                            className="max-w-full max-h-full object-contain filter drop-shadow-sm" 
                                            onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} 
                                        />
                                    </div>
                                </div>

                                {/* Logo Upload & Action Controls */}
                                <div className="flex-1 w-full min-w-0 space-y-3">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5 text-center sm:text-left">
                                        Upload New Logo
                                    </span>
                                    
                                    <div className="space-y-2">
                                        <label 
                                            htmlFor="global-logo-upload" 
                                            className="cursor-pointer flex items-center justify-center gap-2 w-full py-2.5 px-4 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                        >
                                            <UploadCloudIcon className="w-4 h-4 text-blue-500 flex-shrink-0"/>
                                            <span className="truncate">Choose Logo File</span>
                                        </label>
                                        <input 
                                            id="global-logo-upload" 
                                            type="file" 
                                            className="sr-only" 
                                            accept="image/png, image/jpeg, image/svg+xml" 
                                            onChange={handleGlobalLogoFileChange} 
                                        />
                                        
                                        {newLogoFile ? (
                                            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-2 text-xs">
                                                <span className="text-blue-700 dark:text-blue-300 truncate font-mono font-medium flex-1">
                                                    📄 {newLogoFile.name}
                                                </span>
                                                <span className="text-blue-500 font-mono text-[10px] flex-shrink-0">
                                                    {(newLogoFile.size / 1024).toFixed(0)} KB
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center sm:text-left leading-tight">
                                                Transparent background PNG or vector SVG recommended.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <button 
                                            onClick={handleSaveGlobalLogo} 
                                            disabled={!newLogoFile || isUploadingGlobalLogo} 
                                            className="flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                                        >
                                            {isUploadingGlobalLogo && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                            <span>Save Logo</span>
                                        </button>
                                        <button 
                                            onClick={handleResetGlobalLogo} 
                                            disabled={isUploadingGlobalLogo} 
                                            className="py-2.5 px-3.5 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 bg-gray-200/80 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 rounded-xl transition"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Favicon Section */}
                        <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span>Application Icon (Favicon)</span>
                                </h4>
                                <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-gray-200/70 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    ICO / PNG / SVG
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 min-w-0">
                                {/* Favicon Preview */}
                                <div className="w-full sm:w-auto flex flex-col items-center sm:items-start flex-shrink-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5 text-center sm:text-left">
                                        Icon Preview
                                    </span>
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-950 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-800 dark:border-gray-700 p-2 shadow-inner overflow-hidden">
                                        <img 
                                            src={faviconPreview || faviconUrl || defaultFaviconUrl} 
                                            alt="Favicon Preview" 
                                            className="w-12 h-12 sm:w-16 sm:h-16 object-contain filter drop-shadow-sm" 
                                            onError={(e) => { e.currentTarget.src = defaultFaviconUrl; }} 
                                        />
                                    </div>
                                </div>

                                {/* Favicon Upload & Action Controls */}
                                <div className="flex-1 w-full min-w-0 space-y-3">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5 text-center sm:text-left">
                                        Upload New Icon
                                    </span>
                                    
                                    <div className="space-y-2">
                                        <label 
                                            htmlFor="favicon-upload" 
                                            className="cursor-pointer flex items-center justify-center gap-2 w-full py-2.5 px-4 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                        >
                                            <UploadCloudIcon className="w-4 h-4 text-blue-500 flex-shrink-0"/>
                                            <span className="truncate">Choose Icon File</span>
                                        </label>
                                        <input 
                                            id="favicon-upload" 
                                            type="file" 
                                            className="sr-only" 
                                            accept="image/png, image/jpeg, image/svg+xml, image/x-icon" 
                                            onChange={handleFaviconFileChange} 
                                        />
                                        
                                        {newFaviconFile ? (
                                            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-2 text-xs">
                                                <span className="text-blue-700 dark:text-blue-300 truncate font-mono font-medium flex-1">
                                                    📄 {newFaviconFile.name}
                                                </span>
                                                <span className="text-blue-500 font-mono text-[10px] flex-shrink-0">
                                                    {(newFaviconFile.size / 1024).toFixed(0)} KB
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center sm:text-left leading-tight">
                                                Used for browser tabs, bookmarks, and PWA shortcuts.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <button 
                                            onClick={handleSaveFavicon} 
                                            disabled={!newFaviconFile || isUploadingFavicon} 
                                            className="flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                                        >
                                            {isUploadingFavicon && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                            <span>Save Icon</span>
                                        </button>
                                        <button 
                                            onClick={handleResetFavicon} 
                                            disabled={isUploadingFavicon} 
                                            className="py-2.5 px-3.5 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 bg-gray-200/80 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 rounded-xl transition"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {currentUserProfile?.role === UserRole.ADMIN && (
                <div className="bg-gradient-to-br from-blue-900/10 via-indigo-900/5 to-white/70 dark:from-blue-950/30 dark:via-indigo-950/15 dark:to-gray-900/60 border border-blue-500/20 dark:border-blue-500/30 rounded-3xl p-4 sm:p-6 lg:p-8 backdrop-blur-lg shadow-lg">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                                    <DatabaseIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                                        Database Backup & Disaster Recovery
                                    </h3>
                                    <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
                                        Host: {dbHost}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-2xl leading-relaxed">
                                Full database backup and restore utility for Administrators. Generate portable JSON or SQL snapshots, restore previous database points, view real-time table record counts, or copy CLI commands.
                            </p>
                        </div>
                        <button 
                            onClick={() => setIsBackupModalOpen(true)}
                            className="w-full md:w-auto px-5 py-3 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 flex-shrink-0"
                        >
                            <DatabaseIcon className="w-4 h-4 flex-shrink-0" />
                            <span>Backup & Restore Center</span>
                        </button>
                    </div>
                </div>
            )}

            {canManageSettings && (
                 <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="min-w-0">
                            <h2 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2.5 truncate">
                                <MegaphoneIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0"/> 
                                <span>Announcements</span>
                            </h2>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                Create and broadcast operational notices to all active users
                            </p>
                        </div>
                        <button 
                            onClick={handleAddAnnouncement} 
                            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 flex items-center justify-center gap-2 flex-shrink-0"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>New Announcement</span>
                        </button>
                    </div>

                    <div className="bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 sm:p-4 backdrop-blur-lg shadow-lg">
                        {/* Mobile Card View for Announcements (< md) */}
                        <div className="grid grid-cols-1 gap-3 md:hidden">
                            {announcements.length === 0 ? (
                                <p className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
                                    No announcements logged yet.
                                </p>
                            ) : (
                                announcements.map((announcement) => {
                                    const isExpired = announcement.expires_at && new Date(announcement.expires_at) < new Date();
                                    return (
                                        <div 
                                            key={announcement.id} 
                                            className="p-3.5 bg-white/90 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 rounded-xl space-y-2.5"
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                {announcement.image_url ? (
                                                    <img src={announcement.image_url} alt="" className="w-12 h-12 object-cover rounded-xl border border-gray-200 dark:border-gray-700 flex-shrink-0" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                        <AnnouncementTypeIcon type={announcement.type} />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                            {announcement.type.replace('_', ' ')}
                                                        </span>
                                                        {isExpired ? (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                                Expired
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                                Active
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-1 truncate">
                                                        {announcement.title}
                                                    </h4>
                                                </div>
                                            </div>

                                            <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 break-words">
                                                {announcement.content}
                                            </p>

                                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60 text-[11px] text-gray-500 dark:text-gray-400">
                                                <span className="truncate">Expires: {announcement.expires_at ? safeFormat(announcement.expires_at, 'MMM d, yyyy HH:mm') : 'Never'}</span>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button onClick={() => handleEditAnnouncement(announcement)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition">
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteAnnouncement(announcement)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 transition">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop Table View for Announcements (>= md) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Announcement</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Expires</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                    {announcements.map((announcement) => {
                                        const isExpired = announcement.expires_at && new Date(announcement.expires_at) < new Date();
                                        return (
                                            <tr key={announcement.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-200">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-4">
                                                        {announcement.image_url ? (
                                                            <img src={announcement.image_url} alt="" className="w-12 h-12 object-cover rounded-md" />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center"><AnnouncementTypeIcon type={announcement.type} /></div>
                                                        )}
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{announcement.title}</div>
                                                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{announcement.content}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{announcement.type.replace('_', ' ')}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {isExpired ? (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">Expired</span>
                                                    ) : (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-800/50 text-green-800 dark:text-green-300">Active</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    {announcement.expires_at ? safeFormat(announcement.expires_at, 'MMM d, yyyy HH:mm') : 'Never'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end space-x-4">
                                                        <button onClick={() => handleEditAnnouncement(announcement)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"><EditIcon className="w-5 h-5"/></button>
                                                        <button onClick={() => handleDeleteAnnouncement(announcement)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"><TrashIcon className="w-5 h-5"/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2.5 truncate">
                            <BuildingIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0"/> 
                            <span>Company Management</span>
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            Manage all registered security providers, response units, and organizations
                        </p>
                    </div>
                    {currentUserProfile?.role === UserRole.ADMIN && (
                         <button 
                            onClick={handleAddCompany} 
                            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 flex items-center justify-center gap-2 flex-shrink-0"
                         >
                            <PlusIcon className="w-4 h-4" />
                            <span>Add New Company</span>
                        </button>
                    )}
                </div>
                <div className="bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 sm:p-4 backdrop-blur-lg shadow-lg">
                    {loading ? (
                        <TacticalSkeleton title="SECURITY COMPANIES" subtitle="Loading registered security service providers & dispatch units..." cardsCount={0} rowsCount={5} />
                    ) : (
                        <CompanyManagementTable 
                            companies={companies}
                            users={users}
                            onEdit={handleEditCompany}
                            onDelete={handleDeleteCompany}
                            onView={handleViewCompany}
                        />
                    )}
                </div>
            </div>

            <AddEditCompanyModal 
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                onSave={handleSaveCompany}
                company={selectedCompany}
                isSaving={isSavingCompany}
            />

            <DeleteCompanyModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDeleteCompany}
                companyName={selectedCompany?.name || ''}
            />
            <CompanyDetailModal
                isOpen={!!viewCompany}
                onClose={() => setViewCompany(null)}
                company={viewCompany}
                users={users}
            />
            <AddEditAnnouncementModal 
                isOpen={isAnnouncementModalOpen}
                onClose={() => setIsAnnouncementModalOpen(false)}
                onSave={handleSaveAnnouncement}
                announcementToEdit={announcementToEdit}
            />
            {announcementToDelete && (
                <ConfirmModal
                    isOpen={!!announcementToDelete}
                    onClose={() => setAnnouncementToDelete(null)}
                    onConfirm={confirmDeleteAnnouncement}
                    title="Delete Announcement"
                    message={`Are you sure you want to permanently delete the announcement: "<strong>${announcementToDelete.title}</strong>"? This action cannot be undone.`}
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            )}
            <DatabaseBackupModal 
                isOpen={isBackupModalOpen}
                onClose={() => setIsBackupModalOpen(false)}
                dbHost={dbHost}
                profile={currentUserProfile}
            />
            {confirmAction && (
                <ConfirmModal
                    isOpen={!!confirmAction}
                    onClose={() => setConfirmAction(null)}
                    onConfirm={() => {
                        confirmAction.onConfirm();
                        setConfirmAction(null);
                    }}
                    title={confirmAction.title}
                    message={confirmAction.message}
                    confirmText="Confirm"
                />
            )}
        </div>
    );
};

export default CompaniesPage;