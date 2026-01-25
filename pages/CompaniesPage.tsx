import React, { useState, useEffect } from 'react';
import { PlusIcon, BuildingIcon, UploadCloudIcon } from '../components/icons';
import { Company, Profile, UserRole } from '../types';
import CompanyManagementTable from '../components/CompanyManagementTable';
import AddEditCompanyModal from '../components/AddEditCompanyModal';
import DeleteCompanyModal from '../components/DeleteCompanyModal';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';

const CompaniesPage: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [users, setUsers] = useState<Pick<Profile, 'id' | 'company_id'>[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
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


    useEffect(() => {
        const fetchCurrentUserProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                setCurrentUserProfile(profileData);
            } else {
                setLoading(false);
            }
        };
        fetchCurrentUserProfile();
    }, []);

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

            const companiesQuery = supabase.from('companies').select('*');
            if (currentUserProfile.role !== UserRole.ADMIN && currentUserProfile.company_id) {
                companiesQuery.eq('id', currentUserProfile.company_id);
            }

            const usersQuery = supabase.from('profiles').select('id, company_id');
            if (currentUserProfile.role !== UserRole.ADMIN && currentUserProfile.company_id) {
                usersQuery.eq('company_id', currentUserProfile.company_id);
            }

            const { data: companiesData, error: cError } = await companiesQuery;
            const { data: usersData, error: uError } = await usersQuery;
            
            if (cError) console.error('Error fetching companies:', cError);
            else setCompanies(companiesData || []);
            
            if (uError) console.error('Error fetching users:', uError);
            else setUsers(usersData || []);

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

    const handleSaveCompany = async (companyData: { id?: string; name: string; logo_url?: string; }, logoFile: File | null) => {
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
            let error;

            const dbPayload = { name: companyData.name, logo_url: finalLogoUrl };

            if (companyData.id) {
                const { data, error: updateError } = await supabase.from('companies').update(dbPayload).eq('id', companyData.id).select().single();
                savedCompany = data;
                error = updateError;
            } else {
                const { data, error: insertError } = await supabase.from('companies').insert(dbPayload).select().single();
                savedCompany = data;
                error = insertError;
            }

            if (error) throw error;
            
            if (savedCompany) {
                if (companyData.id) {
                    setCompanies(companies.map(c => c.id === savedCompany!.id ? savedCompany : c));
                } else {
                    setCompanies([...companies, savedCompany]);
                }
                addToast(`Company '${savedCompany.name}' saved successfully.`, 'success');
            }
        } catch (error: any) {
            addToast('Error saving company: ' + error.message, 'error');
        } finally {
            setIsAddEditModalOpen(false);
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

                const { error } = await supabase.from('companies').delete().eq('id', selectedCompany.id);
                if (error) throw error;
                
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

            const { error: dbError } = await supabase
                .from('app_settings')
                .update({ value: newUrl })
                .eq('key', 'main_logo_url');
            
            if (dbError) throw dbError;

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
            const { error } = await supabase
                .from('app_settings')
                .update({ value: null })
                .eq('key', 'main_logo_url');
            
            if (error) throw error;

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

            const { error: dbError } = await supabase
                .from('app_settings')
                .upsert({ key: 'favicon_url', value: newUrl });
            
            if (dbError) throw dbError;

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
            const { error } = await supabase
                .from('app_settings')
                .update({ value: null })
                .eq('key', 'favicon_url');
            
            if (error) throw error;

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
            
            <div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <BuildingIcon className="w-8 h-8"/> Company Management
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage all companies and organizations.</p>
                    </div>
                    <button 
                        onClick={handleAddCompany}
                        className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>Add New Company</span>
                    </button>
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
                        />
                    )}
                </div>
            </div>

            <AddEditCompanyModal 
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                onSave={handleSaveCompany}
                company={selectedCompany}
            />

            <DeleteCompanyModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDeleteCompany}
                companyName={selectedCompany?.name || ''}
            />
        </div>
    );
};

export default CompaniesPage;
