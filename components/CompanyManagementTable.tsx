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
        <div>
            {/* Mobile Card View (screens < md) */}
            <div className="grid grid-cols-1 gap-3.5 md:hidden">
                {companies.map((company) => (
                    <div 
                        key={company.id}
                        className="p-4 bg-white/90 dark:bg-gray-800/70 border border-gray-200/80 dark:border-gray-700/60 rounded-2xl shadow-xs space-y-3"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-14 h-14 rounded-xl bg-gray-950/80 dark:bg-gray-950 flex items-center justify-center p-1.5 border border-gray-200 dark:border-gray-700 shadow-inner flex-shrink-0">
                                {company.logo_url ? (
                                    <img className="max-w-full max-h-full object-contain" src={company.logo_url} alt={`${company.name} logo`} />
                                ) : (
                                    <BuildingIcon className="w-6 h-6 text-gray-400" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-base font-bold text-gray-900 dark:text-white truncate">
                                    {company.name}
                                </h4>
                                {company.alias && (
                                    <span className="inline-block text-[11px] font-mono font-bold bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 mt-0.5">
                                        Alias: {company.alias}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-100 dark:border-gray-750">
                            <div>
                                <span className="text-gray-400 uppercase text-[10px] font-bold tracking-wider block">Contact</span>
                                <span className="text-gray-700 dark:text-gray-300 font-medium truncate block">
                                    {company.contact_person || 'N/A'}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-400 uppercase text-[10px] font-bold tracking-wider block">Cell</span>
                                <span className="text-gray-700 dark:text-gray-300 font-medium truncate block">
                                    {company.cell_number || 'N/A'}
                                </span>
                            </div>
                            <div className="col-span-2 flex items-center justify-between pt-1">
                                <span className="text-gray-400 uppercase text-[10px] font-bold tracking-wider">Registered Personnel</span>
                                <div className="flex items-center text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 px-2 py-0.5 rounded-full">
                                    <UsersIcon className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                    {getUserCount(company.id)} members
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-750">
                            <button
                                onClick={() => onView(company)}
                                className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                            >
                                <EyeIcon className="w-4 h-4 text-green-500" />
                                <span>Details</span>
                            </button>
                            <button
                                onClick={() => onEdit(company)}
                                className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-xl border border-blue-200/60 dark:border-blue-800 transition flex items-center justify-center gap-1.5"
                            >
                                <EditIcon className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                            <button
                                onClick={() => onDelete(company)}
                                className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-xl border border-red-200/60 dark:border-red-900 transition flex items-center justify-center"
                                title="Delete Company"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View (screens >= md) */}
            <div className="hidden md:block overflow-x-auto">
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
                                        <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gray-950 p-1 border border-gray-700/60 flex items-center justify-center">
                                            {company.logo_url ? (
                                                <img className="max-h-full max-w-full object-contain" src={company.logo_url} alt={`${company.name} logo`} />
                                            ) : (
                                                <BuildingIcon className="w-6 h-6 text-gray-400" />
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
                                    <div className="flex items-center">
                                        <UsersIcon className="w-4 h-4 mr-2 text-gray-400" />
                                        {getUserCount(company.id)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-3">
                                        <button onClick={() => onView(company)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-green-600 dark:text-green-400 transition-colors" title="View Details">
                                            <EyeIcon className="w-5 h-5"/>
                                        </button>
                                        <button onClick={() => onEdit(company)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400 transition-colors" title="Edit Company">
                                            <EditIcon className="w-5 h-5"/>
                                        </button>
                                        <button onClick={() => onDelete(company)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 transition-colors" title="Delete Company">
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CompanyManagementTable;