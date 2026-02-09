import React from 'react';
import { Profile } from '../types';
import { XIcon, UserIcon } from './icons';

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: Profile | null;
    companyName?: string;
}

const DetailItem: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
    <div>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-gray-800 dark:text-gray-200">{value || 'N/A'}</p>
    </div>
);

const UserDetailModal: React.FC<UserDetailModalProps> = ({ isOpen, onClose, user, companyName }) => {
    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <div className="flex items-start gap-6 mb-6">
                    <div className="flex-shrink-0 h-20 w-20 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700">
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt="User Avatar" className="h-full w-full object-cover rounded-full" />
                        ) : (
                            <UserIcon className="w-10 h-10 text-gray-400" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{user.first_name} {user.surname}</h3>
                        <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
                        <div className="mt-2 space-x-2">
                            <span className="px-3 py-1 text-xs font-bold rounded-full capitalize border bg-blue-500/20 text-blue-500 dark:text-blue-400 border-blue-500/30">{user.role}</span>
                            <span className="px-3 py-1 text-xs font-bold rounded-full capitalize border bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">{user.status}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-6">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">Contact & Personal Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <DetailItem label="Cell Number" value={user.cell} />
                        <DetailItem label="ICE Number" value={user.ice_no} />
                        <div className="md:col-span-2">
                            <DetailItem label="Home Address" value={user.home_address} />
                        </div>
                         <DetailItem label="Vehicle Registration" value={user.vehicle_reg} />
                        <DetailItem label="Medical Aid" value={user.medical_aid} />
                    </div>

                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">Professional Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <DetailItem label="Company" value={companyName} />
                        <DetailItem label="PSIRA Number" value={user.psira_number} />
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Close</button>
                </div>
            </div>
        </div>
    );
};
export default UserDetailModal;