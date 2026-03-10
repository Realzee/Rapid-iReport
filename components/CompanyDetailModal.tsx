import React from 'react';
import { Company, Profile, UserRole } from '../types';
import { XIcon, BuildingIcon, UsersIcon } from './icons';

interface CompanyDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    company: Company | null;
    users: Profile[];
}

const DetailItem: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
    <div>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-gray-800 dark:text-gray-200">{value || 'N/A'}</p>
    </div>
);

const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({ isOpen, onClose, company, users }) => {
    if (!isOpen || !company) return null;

    const companyUsers = users.filter(u => u.company_id === company.id);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <div className="flex items-start gap-6 mb-6">
                    <div className="flex-shrink-0 h-20 w-20 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        {company.logo_url ? (
                            <img src={company.logo_url} alt={`${company.name} logo`} className="h-full w-full object-contain p-2" />
                        ) : (
                            <BuildingIcon className="w-10 h-10 text-gray-400" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{company.name}</h3>
                        <p className="text-gray-500 dark:text-gray-400">Company Details</p>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <DetailItem label="Owner's Name" value={company.owners_name} />
                        <DetailItem label="PSIRA Number" value={company.psira_number} />
                        <DetailItem label="Contact Person" value={company.contact_person} />
                        <DetailItem label="Cell Number" value={company.cell_number} />
                        <div className="md:col-span-2">
                           <DetailItem label="Address" value={company.address} />
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                            <UsersIcon className="w-5 h-5" /> Associated Users ({companyUsers.length})
                        </h4>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                            {companyUsers.length > 0 ? (
                                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {companyUsers.map(user => (
                                        <li key={user.id} className="py-2 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <img src={user.avatar_url || `https://i.pravatar.cc/32?u=${user.id}`} alt="avatar" className="w-8 h-8 rounded-full"/>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{user.first_name} {user.surname}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold capitalize text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">{user.role}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-4">No users are associated with this company.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors">Close</button>
                </div>
            </div>
        </div>
    );
};
export default CompanyDetailModal;