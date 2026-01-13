import React from 'react';
import { Company, Profile } from '../types';
import { EditIcon, TrashIcon, UsersIcon } from './icons';

interface CompanyManagementTableProps {
    companies: Company[];
    users: Profile[];
    onEdit: (company: Company) => void;
    onDelete: (company: Company) => void;
}

const CompanyManagementTable: React.FC<CompanyManagementTableProps> = ({ companies, users, onEdit, onDelete }) => {
    
    const getUserCount = (companyId: string) => {
        return users.filter(user => user.company_id === companyId).length;
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Company Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User Count</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {companies.map((company) => (
                        <tr key={company.id} className="hover:bg-gray-800/40 transition-colors duration-200">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-white">{company.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                <div className="flex items-center">
                                    <UsersIcon className="w-4 h-4 mr-2 text-gray-400" />
                                    {getUserCount(company.id)}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-4">
                                    <button onClick={() => onEdit(company)} className="text-blue-400 hover:text-blue-300 transition-colors">
                                        <EditIcon className="w-5 h-5"/>
                                    </button>
                                    <button onClick={() => onDelete(company)} className="text-red-400 hover:text-red-300 transition-colors">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CompanyManagementTable;
