import React from 'react';
import { Profile, Company, UserRole, UserStatus } from '../types';
import { EditIcon, TrashIcon } from './icons';
import { formatDistanceToNow } from 'date-fns';

interface RoleBadgeProps { role: UserRole; }
const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
    const styles: Record<UserRole, string> = {
        [UserRole.ADMIN]: 'bg-red-500/20 text-red-400 border-red-500/30',
        [UserRole.MODERATOR]: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        [UserRole.CONTROLLER]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        [UserRole.RESPONDER]: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        [UserRole.USER]: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize border ${styles[role]}`}>{role}</span>;
};

interface UserStatusBadgeProps { status: UserStatus; }
const UserStatusBadge: React.FC<UserStatusBadgeProps> = ({ status }) => {
    const styles: Record<UserStatus, string> = {
        [UserStatus.ACTIVE]: 'bg-green-500/20 text-green-400 border-green-500/30',
        [UserStatus.PENDING]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        [UserStatus.SUSPENDED]: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize border ${styles[status]}`}>{status}</span>;
};

interface UserManagementTableProps {
  users: Profile[];
  companies: Company[];
  onEdit: (user: Profile) => void;
  onDelete: (user: Profile) => void;
}

const isOnline = (lastSeen?: string): boolean => {
    if (!lastSeen) return false;
    // A user is online if their last_seen was within the last 5 minutes
    const lastSeenDate = new Date(lastSeen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeenDate > fiveMinutesAgo;
};

const UserManagementTable: React.FC<UserManagementTableProps> = ({ users, companies, onEdit, onDelete }) => {
    const getCompanyName = (companyId?: string) => {
        return companies.find(c => c.id === companyId)?.name || 'N/A';
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Company</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Last Seen</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-800/40 transition-colors duration-200">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10 relative">
                                        <img className="h-10 w-10 rounded-full" src={user.avatar_url || `https://i.pravatar.cc/40?u=${user.id}`} alt="" />
                                        <span
                                            className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-gray-800 ${
                                                isOnline(user.last_seen_at) ? 'bg-green-400' : 'bg-gray-500'
                                            }`}
                                        />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-white">{user.full_name}</div>
                                        <div className="text-sm text-gray-400">{user.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{getCompanyName(user.company_id)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <RoleBadge role={user.role} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <UserStatusBadge status={user.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                {isOnline(user.last_seen_at) ? (
                                    <span className="text-green-400 font-medium">Online</span>
                                ) : user.last_seen_at ? (
                                    formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true })
                                ) : (
                                    'Never'
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-4">
                                    <button onClick={() => onEdit(user)} className="text-blue-400 hover:text-blue-300 transition-colors">
                                        <EditIcon className="w-5 h-5"/>
                                    </button>
                                    <button onClick={() => onDelete(user)} className="text-red-400 hover:text-red-300 transition-colors">
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

export default UserManagementTable;
