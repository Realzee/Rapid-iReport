import React from 'react';
import { Company, Profile } from '../types';
import { EditIcon, TrashIcon, UsersIcon, BuildingIcon, EyeIcon } from './icons';

interface CompanyManagementTableProps {
    companies: Company[];
    users: Pick<Profile, 'id' | 'company_id'>[];
    onEdit: (company: Company) => void;
    onDelete: (company: Company) => void;
    onView: (company: Company) => void;
}

const CompanyManagementTable: React.FC<CompanyManagementTableProps> = ({ companies, users, onEdit, onDelete, onView }) => {
    
    const getUserCount = (companyId: string) => {
        return users.filter(user => user.company_id === companyId).length;
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Company Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Contact Person</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cell Number</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User Count</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {companies.map((company) => (
                        <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-200">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-12 w-12">
                                        {company.logo_url ? (
                                            <img className="h-12 w-12 rounded-md object-contain" src={company.logo_url} alt={`${company.name} logo`} />
                                        ) : (
                                            <div className="h-12 w-12 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md">
                                                <BuildingIcon className="w-6 h-6 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{company.name}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{company.contact_person || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{company.cell_number || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                <div className="flex items-center">
                                    <UsersIcon className="w-4 h-4 mr-2 text-gray-400" />
                                    {getUserCount(company.id)}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-4">
                                    <button onClick={() => onView(company)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors" title="View Details">
                                        <EyeIcon className="w-5 h-5"/>
                                    </button>
                                    <button onClick={() => onEdit(company)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors" title="Edit Company">
                                        <EditIcon className="w-5 h-5"/>
                                    </button>
                                    <button onClick={() => onDelete(company)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Delete Company">
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