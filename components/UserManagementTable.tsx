

import React, { memo } from 'react';
import { Profile, Company, UserRole, UserStatus } from '../types';
import { EditIcon, TrashIcon } from './icons';
import { formatDistanceToNow } from 'date-fns';

interface RoleBadgeProps { role: UserRole; }
const RoleBadge: React.FC<RoleBadgeProps> = memo(({ role }) => {
    const styles: Record<UserRole, string> = {
        [UserRole.ADMIN]: 'bg-red-500/20 text-red-500 dark:text-red-400 border-red-500/30',
        [UserRole.MODERATOR]: 'bg-purple-500/20 text-purple-500 dark:text-purple-400 border-purple-500/30',
        [UserRole.CONTROLLER]: 'bg-blue-500/20 text-blue-500 dark:text-blue-400 border-blue-500/30',
        [UserRole.RESPONDER]: 'bg-orange-500/20 text-orange-500 dark:text-orange-400 border-orange-500/30',
        [UserRole.USER]: 'bg-gray-500/20 text-gray-500 dark:text-gray-400 border-gray-500/30',
    };
    return <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize border ${styles[role]}`}>{role}</span>;
});

interface UserStatusBadgeProps { status: UserStatus; }
const UserStatusBadge: React.FC<UserStatusBadgeProps> = memo(({ status }) => {
    const styles: Record<UserStatus, string> = {
        [UserStatus.ACTIVE]: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
        [UserStatus.PENDING]: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
        [UserStatus.SUSPENDED]: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
    };
    return <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize border ${styles[status]}`}>{status}</span>;
});

interface UserManagementTableProps {
  users: Profile[];
  companies: Company[];
  onEdit: (user: Profile) => void;
  onDelete: (user: Profile) => void;
  currentUserProfile: Profile | null;
  onRoleChange: (userId: string, newRole: UserRole) => void;
  updatingRoleId: string | null;
}

const isOnline = (lastSeen?: string): boolean => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeenDate > fiveMinutesAgo;
};

const UserManagementTable: React.FC<UserManagementTableProps> = ({ users, companies, onEdit, onDelete, currentUserProfile, onRoleChange, updatingRoleId }) => {
    const getCompanyName = (companyId?: string) => {
        return companies.find(c => c.id === companyId)?.name || 'N/A';
    };

    const renderLastSeen = (lastSeen?: string) => {
        if (isOnline(lastSeen)) {
            return <span className="text-green-500 dark:text-green-400 font-medium">Online</span>;
        }
        return lastSeen ? formatDistanceToNow(new Date(lastSeen), { addSuffix: true }) : 'Never';
    };

    return (
        <div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {users.map(user => (
                    <div key={user.id} className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700/50">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0 h-10 w-10 relative">
                                    <img className="h-10 w-10 rounded-full" src={user.avatar_url || `https://i.pravatar.cc/40?u=${user.id}`} alt="" />
                                    <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${isOnline(user.last_seen_at) ? 'bg-green-400' : 'bg-gray-500'}`} />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white truncate">{`${user.first_name || ''} ${user.surname || ''}`}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                                </div>
                            </div>
                            <div className="flex space-x-2 flex-shrink-0">
                                <button onClick={() => onEdit(user)} className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"><EditIcon className="w-5 h-5"/></button>
                                <button onClick={() => onDelete(user)} className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Role</p>
                                <RoleBadge role={user.role} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                                <UserStatusBadge status={user.status} />
                            </div>
                             <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Cell</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{user.cell || 'N/A'}</p>
                            </div>
                            <div className="col-span-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Company</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{getCompanyName(user.company_id)}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Last Seen</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200">{renderLastSeen(user.last_seen_at)}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cell Number</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Company</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Seen</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {users.map((user) => {
                             if (!currentUserProfile) return null;

                            const canEditUser = (
                                user.id !== currentUserProfile.id &&
                                (currentUserProfile.role === UserRole.ADMIN ||
                                (currentUserProfile.role === UserRole.MODERATOR && user.company_id === currentUserProfile.company_id))
                            );

                            const isUpdating = updatingRoleId === user.id;

                            let roleOptions = Object.values(UserRole);
                            if (currentUserProfile.role === UserRole.MODERATOR) {
                                // Moderators can't create other admins or moderators
                                roleOptions = [UserRole.USER, UserRole.RESPONDER, UserRole.CONTROLLER];
                            }

                            return (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-200">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 relative">
                                                <img className="h-10 w-10 rounded-full" src={user.avatar_url || `https://i.pravatar.cc/40?u=${user.id}`} alt="" />
                                                <span
                                                    className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${
                                                        isOnline(user.last_seen_at) ? 'bg-green-400' : 'bg-gray-500'
                                                    }`}
                                                />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{`${user.first_name || ''} ${user.surname || ''}`}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.cell || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getCompanyName(user.company_id)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {canEditUser ? (
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={user.role}
                                                    onChange={(e) => onRoleChange(user.id, e.target.value as UserRole)}
                                                    disabled={isUpdating}
                                                    className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-1 px-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed capitalize"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {roleOptions.map(role => (
                                                        <option key={role} value={role} className="capitalize">{role}</option>
                                                    ))}
                                                </select>
                                                {isUpdating && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                                            </div>
                                        ) : (
                                            <RoleBadge role={user.role} />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <UserStatusBadge status={user.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {renderLastSeen(user.last_seen_at)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-4">
                                            <button onClick={() => onEdit(user)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                                                <EditIcon className="w-5 h-5"/>
                                            </button>
                                            <button onClick={() => onDelete(user)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                                                <TrashIcon className="w-5 h-5"/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default memo(UserManagementTable);