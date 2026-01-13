import React, { useState, useMemo } from 'react';
import { PlusIcon, BuildingIcon } from '../components/icons';
import { Company, Profile } from '../types';
import { mockUsers, mockCompanies } from '../data/mockUsers';
import CompanyManagementTable from '../components/CompanyManagementTable';
import AddEditCompanyModal from '../components/AddEditCompanyModal';
import DeleteCompanyModal from '../components/DeleteCompanyModal';

const CompaniesPage: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>(mockCompanies);
    const [users, setUsers] = useState<Profile[]>(mockUsers);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

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

    const handleSaveCompany = (company: Company) => {
        if (selectedCompany) {
            setCompanies(companies.map(c => (c.id === company.id ? company : c)));
        } else {
            setCompanies([...companies, { ...company, id: `c${companies.length + 1}` }]);
        }
        setIsAddEditModalOpen(false);
    };

    const confirmDeleteCompany = () => {
        if (selectedCompany) {
            setCompanies(companies.filter(c => c.id !== selectedCompany.id));
            // Also un-assign users from the deleted company
            setUsers(users.map(u => u.company_id === selectedCompany.id ? { ...u, company_id: undefined } : u));
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
                <CompanyManagementTable 
                    companies={companies}
                    users={users}
                    onEdit={handleEditCompany}
                    onDelete={handleDeleteCompany}
                />
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
