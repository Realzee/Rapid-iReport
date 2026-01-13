import React, { useState, useEffect } from 'react';
import { PlusIcon, BuildingIcon } from '../components/icons';
import { Company, Profile } from '../types';
import CompanyManagementTable from '../components/CompanyManagementTable';
import AddEditCompanyModal from '../components/AddEditCompanyModal';
import DeleteCompanyModal from '../components/DeleteCompanyModal';
import { supabase } from '../utils/supabase';

const CompaniesPage: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    // FIX: Changed the type of 'users' to match the partial data being fetched (only id and company_id).
    // This avoids fetching all user data when only the count is needed, improving performance.
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

    const handleSaveCompany = async (companyData: { id?: string, name: string }) => {
        let savedCompany: Company | null = null;
        let error;

        if (companyData.id) { // Update
            const { data, error: updateError } = await supabase.from('companies').update({ name: companyData.name }).eq('id', companyData.id).select().single();
            savedCompany = data;
            error = updateError;
        } else { // Insert
            const { data, error: insertError } = await supabase.from('companies').insert({ name: companyData.name }).select().single();
            savedCompany = data;
            error = insertError;
        }

        if (error) {
            alert('Error saving company: ' + error.message);
        } else if (savedCompany) {
            if (companyData.id) {
                 setCompanies(companies.map(c => c.id === savedCompany!.id ? savedCompany : c));
            } else {
                setCompanies([...companies, savedCompany]);
            }
        }
        setIsAddEditModalOpen(false);
    };

    const confirmDeleteCompany = async () => {
        if (selectedCompany) {
            const { error } = await supabase.from('companies').delete().eq('id', selectedCompany.id);
            if (error) {
                alert('Error deleting company: ' + error.message);
            } else {
                 setCompanies(companies.filter(c => c.id !== selectedCompany.id));
            }
        }
        setIsDeleteModalOpen(false);
        setSelectedCompany(null);
    };

    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <BuildingIcon className="w-8 h-8"/> Company Management
                    </h2>
                    <p className="text-gray-400 mt-1">Manage all companies and organizations.</p>
                </div>
                <button 
                    onClick={handleAddCompany}
                    className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Add New Company</span>
                </button>
            </div>

            <div className="bg-gray-900/50 border border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm">
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