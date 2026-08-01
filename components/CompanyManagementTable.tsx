import React from 'react';
import { Company, Profile } from '../types';
import { EditIcon, TrashIcon, UsersIcon, BuildingIcon, EyeIcon, CheckIcon, XIcon } from './icons';

interface CompanyManagementTableProps {
    companies: Company[];
    users: Pick<Profile, 'id' | 'company_id'>[];
    onEdit: (company: Company) => void;
    onDelete: (company: Company) => void;
    onView: (company: Company) => void;
    isGlobalAdmin?: boolean;
    onApprove?: (company: Company) => void;
    onReject?: (company: Company) => void;
}

const CompanyManagementTable: React.FC<CompanyManagementTableProps> = ({ 
    companies, 
    users, 
    onEdit, 
    onDelete, 
    onView,
    isGlobalAdmin,
    onApprove,
    onReject
}) => {
    
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
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User Count</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {companies.map((company) => (
                        <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-200">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-16 w-16">
                                        {company.logo_url ? (
                                            <img className="h-16 w-16 rounded-md object-contain" src={company.logo_url} alt={`${company.name} logo`} />
                                        ) : (
                                            <div className="h-16 w-16 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md">
                                                <BuildingIcon className="w-6 h-6 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">{company.name}</div>
                                        {company.alias && (
                                            <div className="text-xs font-semibold bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-500/20 inline-block mt-1">
                                                Alias: {company.alias}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{company.contact_person || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{company.cell_number || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full border uppercase inline-block ${
                                    company.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50' :
                                    company.status === 'rejected' ? 'bg-rose-100 dark:bg-rose-950/30 text-rose-800 dark:text-rose-400 border-rose-200 dark:border-rose-900/50' :
                                    'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                                }`}>
                                    {company.status || 'pending'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                <div className="flex items-center">
                                    <UsersIcon className="w-4 h-4 mr-2 text-gray-400" />
                                    {getUserCount(company.id)}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-3">
                                    {isGlobalAdmin && company.status !== 'approved' && (
                                        <button onClick={() => onApprove?.(company)} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors p-1 bg-emerald-50 dark:bg-emerald-950/20 rounded-md border border-emerald-200/50 dark:border-emerald-900/30" title="Approve Onboarding">
                                            <CheckIcon className="w-5 h-5"/>
                                        </button>
                                    )}
                                    {isGlobalAdmin && company.status === 'pending' && (
                                        <button onClick={() => onReject?.(company)} className="text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 transition-colors p-1 bg-rose-50 dark:bg-rose-950/20 rounded-md border border-rose-200/50 dark:border-rose-900/30" title="Reject Onboarding">
                                            <XIcon className="w-5 h-5"/>
                                        </button>
                                    )}
                                    <button onClick={() => onView(company)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors p-1" title="View Details">
                                        <EyeIcon className="w-5 h-5"/>
                                    </button>
                                    <button onClick={() => onEdit(company)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-1" title="Edit Company">
                                        <EditIcon className="w-5 h-5"/>
                                    </button>
                                    <button onClick={() => onDelete(company)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1" title="Delete Company">
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