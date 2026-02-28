

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
import { format } from 'date-fns';
import CompanyDetailModal from '../components/CompanyDetailModal';

const AnnouncementTypeIcon: React.FC<{ type: AnnouncementType, className?: string }> = ({ type, className="w-6 h-6" }) => {
    switch (type) {
        case AnnouncementType.ALERT: return <AlertTriangleIcon className={`${className} text-red-500`} />;
        case AnnouncementType.NOTICE: return <MegaphoneIcon className={`${className} text-blue-500`} />;
        case AnnouncementType.SAFETY_TIP: return <LightbulbIcon className={`${className} text-yellow-500`} />;
        default: return <MegaphoneIcon className={`${className} text-gray-500`} />;
    }
};

const CompaniesPage: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [viewCompany, setViewCompany] = useState<Company | null>(null);
    const { addToast } = useToast();
    const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

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
        const fetchCurrentUserProfile = async () => {
            // FIX: Using bracket notation to bypass potential SupabaseAuthClient type errors.
            const { data: { session } } = await supabase.auth['getSession']();
            if (session?.user) {
                const { data: profileData, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
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
    }, [addToast]);

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

            const companiesQuery = supabase.from('companies').select('*');
            if (!canManageAll && currentUserProfile.company_id) {
                companiesQuery.eq('id', currentUserProfile.company_id);
            }

            const usersQuery = supabase.from('profiles').select('*');
            if (!canManageAll && currentUserProfile.company_id) {
                usersQuery.eq('company_id', currentUserProfile.company_id);
            }
            
            const announcementsQuery = supabase.from('announcements').select('*').order('created_at', { ascending: false });

            const [
                { data: companiesData, error: cError },
                { data: usersData, error: uError },
                { data: announcementsData, error: aError }
            ] = await Promise.all([companiesQuery, usersQuery, announcementsQuery]);
            
            if (cError) console.error('Error fetching companies:', cError);
            else setCompanies(companiesData || []);
            
            if (uError) console.error('Error fetching users:', uError);
            else setUsers(usersData || []);
            
            if (aError) console.error("Error fetching announcements:", aError);
            else setAnnouncements(announcementsData || []);

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

    const handleSaveCompany = async (companyData: Partial<Company>, logoFile: File | null) => {
        setIsSavingCompany(true);
        let finalLogoUrl = companyData.logo_url;

        try {
            if (logoFile) {
                const companyId = companyData.id || crypto.randomUUID();
                const fileExt = logoFile.name.split('.').pop();
                const filePath = `${companyId}/logo.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('company-logos')
                    .upload(filePath, logoFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(filePath);
                finalLogoUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            }

            let savedCompany: Company | null = null;
            
            const response = await fetch('/api/save-company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...companyData, logo_url: finalLogoUrl })
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
                if (companyData.id) {
                    setCompanies(companies.map(c => c.id === savedCompany!.id ? savedCompany! : c));
                } else {
                    setCompanies([...companies, savedCompany]);
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

                const response = await fetch('/api/delete-company', {
                    method: 'POST',
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

    const handleResetGlobalLogo = async () => {
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

    const handleResetFavicon = async () => {
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

            const response = await fetch('/api/save-announcement', {
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
                const response = await fetch('/api/delete-announcement', {
                    method: 'POST',
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
        <div className="container mx-auto space-y-8">
            {currentUserProfile?.role === UserRole.ADMIN && (
                <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 backdrop-blur-lg shadow-lg">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Global Branding</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-12">
                        {/* Logo Section */}
                        <div>
                             <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Main Application Logo</h4>
                            <div className="flex items-start gap-6">
                                <div className="flex-shrink-0">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logo Preview</p>
                                    <div className="w-48 h-24 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border border-gray-300 dark:border-gray-700">
                                        <img src={logoPreview} alt="Main Logo Preview" className="max-w-full max-h-full object-contain p-2" />
                                    </div>
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload New Logo</p>
                                    <div className="flex items-center gap-4">
                                        <label htmlFor="global-logo-upload" className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                            <UploadCloudIcon className="w-5 h-5"/>
                                            <span>Choose File</span>
                                        </label>
                                        <input id="global-logo-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/svg+xml" onChange={handleGlobalLogoFileChange} />
                                        {newLogoFile && <span className="text-sm text-gray-500 dark:text-gray-400">{newLogoFile.name}</span>}
                                    </div>
                                    <div className="mt-4 flex items-center gap-3">
                                        <button onClick={handleSaveGlobalLogo} disabled={!newLogoFile || isUploadingGlobalLogo} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                                            {isUploadingGlobalLogo ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                                            Save Logo
                                        </button>
                                        <button onClick={handleResetGlobalLogo} disabled={isUploadingGlobalLogo} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Favicon Section */}
                        <div>
                             <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Application Icon (Favicon)</h4>
                             <div className="flex items-start gap-6">
                                <div className="flex-shrink-0">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Icon Preview</p>
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border border-gray-300 dark:border-gray-700">
                                        <img src={faviconPreview} alt="Favicon Preview" className="w-12 h-12 object-contain" />
                                    </div>
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload New Icon</p>
                                    <div className="flex items-center gap-4">
                                        <label htmlFor="favicon-upload" className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                            <UploadCloudIcon className="w-5 h-5"/>
                                            <span>Choose File</span>
                                        </label>
                                        <input id="favicon-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/svg+xml, image/x-icon" onChange={handleFaviconFileChange} />
                                        {newFaviconFile && <span className="text-sm text-gray-500 dark:text-gray-400">{newFaviconFile.name}</span>}
                                    </div>
                                    <div className="mt-4 flex items-center gap-3">
                                        <button onClick={handleSaveFavicon} disabled={!newFaviconFile || isUploadingFavicon} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                                            {isUploadingFavicon ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                                            Save Icon
                                        </button>
                                        <button onClick={handleResetFavicon} disabled={isUploadingFavicon} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">
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
                <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 backdrop-blur-lg shadow-lg">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                        <DatabaseIcon className="w-7 h-7" />
                        Database Management
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Database Backup</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Create a full backup of the PostgreSQL database. This requires using the `pg_dump` command-line tool.
                            </p>
                        </div>
                        <button 
                            onClick={() => setIsBackupModalOpen(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition"
                        >
                            Generate Backup Command
                        </button>
                    </div>
                </div>
            )}

            {canManageSettings && (
                 <div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                <MegaphoneIcon className="w-8 h-8"/> Announcements
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Create and manage global announcements for all users.</p>
                        </div>
                        <button onClick={handleAddAnnouncement} className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2">
                            <PlusIcon className="w-5 h-5" />
                            <span>New Announcement</span>
                        </button>
                    </div>
                    <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg dark:shadow-none transition-colors duration-300">
                        <div className="overflow-x-auto">
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
                                                    {announcement.expires_at ? format(new Date(announcement.expires_at), 'MMM d, yyyy HH:mm') : 'Never'}
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

            <div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <BuildingIcon className="w-8 h-8"/> Company Management
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage all companies and organizations.</p>
                    </div>
                    {currentUserProfile?.role === UserRole.ADMIN && (
                         <button onClick={handleAddCompany} className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2">
                            <PlusIcon className="w-5 h-5" />
                            <span>Add New Company</span>
                        </button>
                    )}
                </div>
                <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg dark:shadow-none transition-colors duration-300">
                    {loading ? (
                         <div className="flex justify-center items-center h-64">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
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
            />
        </div>
    );
};

export default CompaniesPage;