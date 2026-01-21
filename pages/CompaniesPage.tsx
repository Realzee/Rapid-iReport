
import React, { useState, useEffect } from 'react';
import { PlusIcon, BuildingIcon } from '../components/icons';
import { Company, Profile } from '../types';
import CompanyManagementTable from '../components/CompanyManagementTable';
import AddEditCompanyModal from '../components/AddEditCompanyModal';
import DeleteCompanyModal from '../components/DeleteCompanyModal';
import { supabase } from '../utils/supabase';

const CompaniesPage: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [users, setUsers] = useState<Pick<Profile, 'id' | 'company_id'>[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: companiesData, error: cError } = await supabase.from('companies').select('*');
            const { data: usersData, error: uError } = await supabase.from('profiles').select('id, company_id');
            
            if (cError) console.error('Error fetching companies:', cError);
            else setCompanies(companiesData || []);
            
            if (uError) console.error('Error fetching users:', uError);
            else setUsers(usersData || []);

            setLoading(false);
        };
        fetchData();
    }, []);

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
            // Handle file upload if a new file is provided
            if (logoFile) {
                const companyId = companyData.id || crypto.randomUUID();
                const fileExt = logoFile.name.split('.').pop();
                const filePath = `${companyId}/logo.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('company-logos')
                    .upload(filePath, logoFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(filePath);
                finalLogoUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`; // Add timestamp to bust cache
            }

            let savedCompany: Company | null = null;
            let error;

            const dbPayload = { name: companyData.name, logo_url: finalLogoUrl };

            if (companyData.id) { // Update
                const { data, error: updateError } = await supabase.from('companies').update(dbPayload).eq('id', companyData.id).select().single();
                savedCompany = data;
                error = updateError;
            } else { // Insert
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
            }
        } catch (error: any) {
            alert('Error saving company: ' + error.message);
        } finally {
            setIsAddEditModalOpen(false);
        }
    };

    const confirmDeleteCompany = async () => {
        if (selectedCompany) {
            try {
                // First, delete the logo from storage if it exists
                if (selectedCompany.logo_url) {
                    const urlParts = selectedCompany.logo_url.split('/');
                    const filePath = urlParts.slice(urlParts.indexOf('company-logos') + 1).join('/');
                    const [folder, file] = filePath.split('?')[0].split('/');
                    if (folder && file) {
                        await supabase.storage.from('company-logos').remove([`${folder}/${file}`]);
                    }
                }

                // Then, delete the company record
                const { error } = await supabase.from('companies').delete().eq('id', selectedCompany.id);
                if (error) throw error;
                
                setCompanies(companies.filter(c => c.id !== selectedCompany.id));
            } catch (error: any) {
                 alert('Error deleting company: ' + error.message);
            }
        }
        setIsDeleteModalOpen(false);
        setSelectedCompany(null);
    };

    return (
        <div className="container mx-auto">
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