
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PlusIcon, UsersIcon, DownloadIcon, FilterIcon, CheckCircleIcon, ClockIcon, AlertTriangleIcon } from '../components/icons';
import { Profile, Company, UserRole, UserStatus } from '../types';
import UserManagementTable from '../components/UserManagementTable';
import AddEditUserModal from '../components/AddEditUserModal';
import DeleteUserModal from '../components/DeleteUserModal';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import UserDetailModal from '../components/UserDetailModal';
import StatCard from '../components/StatCard';
import { format } from 'date-fns';
import { logUserAction } from '../utils/logger';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [viewUser, setViewUser] = useState<Profile | null>(null);
    const { addToast } = useToast();
    const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
    const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
    const [updatingCompanyId, setUpdatingCompanyId] = useState<string | null>(null);
    const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

    // Filters
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
    const [companyFilter, setCompanyFilter] = useState<string>('all');

    useEffect(() => {
        const fetchCurrentUserProfile = async () => {
            // @ts-ignore
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profileData, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                if (error) {
                    addToast(`Error fetching your profile: ${error.message}`, 'error');
                    setLoading(false);
                } else {
                    setCurrentUserProfile(profileData);
                }
            } else {
                setLoading(false);
            }
        };
        fetchCurrentUserProfile();
    }, [addToast]);

    useEffect(() => {
        if (!currentUserProfile) return;

        const fetchData = async () => {
            setLoading(true);

            const usersQuery = supabase.from('profiles').select('*');
            if (currentUserProfile.role !== UserRole.ADMIN && currentUserProfile.company_id) {
                usersQuery.eq('company_id', currentUserProfile.company_id);
            }

            const companiesQuery = supabase.from('companies').select('*');
            if (currentUserProfile.role !== UserRole.ADMIN && currentUserProfile.company_id) {
                companiesQuery.eq('id', currentUserProfile.company_id);
            }

            const { data: usersData, error: usersError } = await usersQuery;
            const { data: companiesData, error: companiesError } = await companiesQuery;

            if (usersError) console.error('Error fetching users:', usersError);
            else setUsers(usersData || []);

            if (companiesError) console.error('Error fetching companies:', companiesError);
            else setCompanies(companiesData || []);
            
            setLoading(false);
        };
        fetchData();

        // Real-time subscription for profiles
        const profilesChannel = supabase
            .channel('public:profiles')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
                const newRecord = payload.new as Profile;
                const oldRecord = payload.old as Profile;
                
                // If not an admin, only process changes relevant to the current company
                if (currentUserProfile.role !== UserRole.ADMIN && currentUserProfile.company_id) {
                    const newCompanyMatch = newRecord?.company_id === currentUserProfile.company_id;
                    const oldCompanyMatch = oldRecord?.company_id === currentUserProfile.company_id;
                    
                    if (!newCompanyMatch && !oldCompanyMatch) {
                        return; // Ignore changes from other companies entirely
                    }
                }

                if (payload.eventType === 'INSERT') {
                    setUsers(currentUsers => [...currentUsers, newRecord]);
                } else if (payload.eventType === 'UPDATE') {
                    setUsers(currentUsers => currentUsers.map(u => u.id === newRecord.id ? newRecord : u));
                } else if (payload.eventType === 'DELETE') {
                    setUsers(currentUsers => currentUsers.filter(u => u.id !== oldRecord.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(profilesChannel);
        };
    }, [currentUserProfile]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm]);

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // Search Term
            const lowercasedTerm = debouncedSearchTerm.toLowerCase();
            const matchesSearch = !lowercasedTerm || 
                (user.first_name || '').toLowerCase().includes(lowercasedTerm) ||
                (user.surname || '').toLowerCase().includes(lowercasedTerm) ||
                user.email.toLowerCase().includes(lowercasedTerm);

            // Role Filter
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;

            // Status Filter
            const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

            // Company Filter
            const matchesCompany = companyFilter === 'all' || user.company_id === companyFilter;

            return matchesSearch && matchesRole && matchesStatus && matchesCompany;
        });
    }, [users, debouncedSearchTerm, roleFilter, statusFilter, companyFilter]);

    // Statistics
    const stats = useMemo(() => {
        return {
            total: users.length,
            active: users.filter(u => u.status === UserStatus.ACTIVE).length,
            pending: users.filter(u => u.status === UserStatus.PENDING).length,
            suspended: users.filter(u => u.status === UserStatus.SUSPENDED).length
        };
    }, [users]);

    const handleExportCSV = () => {
        const headers = ['ID', 'First Name', 'Surname', 'Email', 'Role', 'Status', 'Company', 'Cell', 'Last Seen'];
        const csvContent = [
            headers.join(','),
            ...filteredUsers.map(u => [
                u.id,
                `"${u.first_name || ''}"`,
                `"${u.surname || ''}"`,
                u.email,
                u.role,
                u.status,
                `"${companies.find(c => c.id === u.company_id)?.name || 'N/A'}"`,
                `"${u.cell || ''}"`,
                `"${u.last_seen_at || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `users_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleAddUser = useCallback(() => {
        setSelectedUser(null);
        setIsAddEditModalOpen(true);
    }, []);

    const handleEditUser = useCallback((user: Profile) => {
        setSelectedUser(user);
        setIsAddEditModalOpen(true);
    }, []);

    const handleDeleteUser = useCallback((user: Profile) => {
        setSelectedUser(user);
        setIsDeleteModalOpen(true);
    }, []);

    const handleViewUser = useCallback((user: Profile) => {
        setViewUser(user);
    }, []);
    
    const handleRoleChange = useCallback(async (userId: string, newRole: UserRole) => {
        setUpdatingRoleId(userId);
        try {
            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update role');
            }

            addToast(`User role updated successfully.`, 'success');
            if (currentUserProfile) {
                logUserAction(currentUserProfile.id, 'UPDATE_USER_ROLE', `Updated role for user ${userId} to ${newRole}`);
            }
        } catch (error: any) {
            addToast(`Error updating role: ${error.message}`, 'error');
        }
        setUpdatingRoleId(null);
    }, [addToast, currentUserProfile]);
    
    const handleStatusChange = useCallback(async (userId: string, newStatus: UserStatus) => {
        setUpdatingStatusId(userId);
        try {
            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, status: newStatus })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update status');
            }

            addToast(`User status updated to ${newStatus}.`, 'success');
            if (currentUserProfile) {
                logUserAction(currentUserProfile.id, 'UPDATE_USER_STATUS', `Updated status for user ${userId} to ${newStatus}`);
            }
        } catch (error: any) {
            addToast(`Error updating status: ${error.message}`, 'error');
        }
        setUpdatingStatusId(null);
    }, [addToast, currentUserProfile]);

    const handleCompanyChange = useCallback(async (userId: string, newCompanyId: string | null) => {
        setUpdatingCompanyId(userId);
        try {
            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, company_id: newCompanyId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update company');
            }

            addToast(`User company updated successfully.`, 'success');
            if (currentUserProfile) {
                const companyName = companies.find(c => c.id === newCompanyId)?.name || 'None';
                logUserAction(currentUserProfile.id, 'UPDATE_USER_COMPANY', `Updated company for user ${userId} to ${companyName}`);
            }
        } catch (error: any) {
            addToast(`Error updating company: ${error.message}`, 'error');
        }
        setUpdatingCompanyId(null);
    }, [addToast, currentUserProfile, companies]);

    const handleSaveUser = useCallback(async (userToSave: Profile, password?: string, avatarFile?: File | null) => {
        // UPDATE user
        if (userToSave.id) {
            let avatarUrlToUpdate = userToSave.avatar_url;

            if (!avatarUrlToUpdate && !avatarFile) {
                addToast('A profile selfie is required for this user. Please upload one.', 'error');
                return;
            }

            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const filePath = `${userToSave.id}/avatar.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });

                if (uploadError) {
                    addToast('Error uploading selfie: ' + uploadError.message, 'error');
                    return;
                }
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                avatarUrlToUpdate = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            }

            const { id, email, ...updateData } = { ...userToSave, avatar_url: avatarUrlToUpdate };
            
            try {
                const response = await fetch('/api/update-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: id, ...updateData })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update user profile');
                }

                addToast('User profile updated successfully.', 'success');
                if (currentUserProfile) {
                    logUserAction(currentUserProfile.id, 'UPDATE_USER_PROFILE', `Updated profile for user ${userToSave.id} (${userToSave.email})`);
                }
            } catch (error: any) {
                addToast('Error updating user profile: ' + error.message, 'error');
            }

            if (password) {
                const response = await fetch('/api/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userToSave.id, password: password })
                });

                if (!response.ok) {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                        const errorData = await response.json();
                        addToast(`Profile saved, but password update failed: ${errorData.error || 'Unknown error'}.`, 'warning');
                    } else {
                        const errorText = await response.text();
                        console.error("Non-JSON error response:", errorText);
                        addToast(`Server error: ${response.status} ${response.statusText}. Check console for details.`, 'warning');
                    }
                } else {
                    addToast('User password was also updated successfully.', 'success');
                }
            }
        } 
        // CREATE user
        else {
            if (!password) {
                addToast("Password is required to create a new user.", 'error');
                return;
            }
            if (!avatarFile) {
                addToast("A profile selfie is required to create a new user.", 'error');
                return;
            }

            const user_metadata: { [key: string]: any } = { ...userToSave };
            delete user_metadata.id;
            delete user_metadata.email;
            
            const response = await fetch('/api/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userToSave.email, password: password, user_metadata: user_metadata })
            });
            
            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    addToast(`Error creating user: ${errorData.error || 'Unknown error'}`, 'error');
                } else {
                    const errorText = await response.text();
                    console.error("Non-JSON error response:", errorText);
                    addToast(`Server error: ${response.status} ${response.statusText}. Check console for details.`, 'error');
                }
                return;
            }

            const functionData = await response.json();
            const newAuthUser = functionData.user;
            if (!newAuthUser) {
                addToast('User creation failed to return a user object.', 'error');
                return;
            }

            // Now upload avatar for the newly created user
            const fileExt = avatarFile.name.split('.').pop();
            const filePath = `${newAuthUser.id}/avatar.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });

            if (uploadError) {
                addToast(`User account created, but selfie upload failed. Please edit the user to add one.`, 'warning');
            } else {
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                
                try {
                    const profileUpdateResponse = await fetch('/api/update-profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            userId: newAuthUser.id, 
                            avatar_url: `${urlData.publicUrl}?t=${new Date().getTime()}` 
                        })
                    });

                    if (!profileUpdateResponse.ok) {
                        const errorData = await profileUpdateResponse.json();
                        throw new Error(errorData.error || 'Failed to link selfie');
                    }

                    addToast('User created successfully!', 'success');
                    if (currentUserProfile) {
                        logUserAction(currentUserProfile.id, 'CREATE_USER', `Created new user ${newAuthUser.id} (${userToSave.email})`);
                    }
                } catch (error: any) {
                    addToast(`User created, but linking selfie failed: ${error.message}`, 'warning');
                }
            }
        }
        setIsAddEditModalOpen(false);
        setSelectedUser(null);
    }, [addToast]);

    const confirmDeleteUser = useCallback(async () => {
        if (selectedUser) {
            const response = await fetch('/api/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedUser.id })
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    addToast('Error deleting user: ' + (errorData.error || 'Unknown error'), 'error');
                } else {
                    const errorText = await response.text();
                    console.error("Non-JSON error response:", errorText);
                    addToast(`Server error: ${response.status} ${response.statusText}. Check console for details.`, 'error');
                }
            } else {
                addToast('User deleted successfully.', 'success');
                if (currentUserProfile) {
                    logUserAction(currentUserProfile.id, 'DELETE_USER', `Deleted user ${selectedUser.id} (${selectedUser.email})`);
                }
            }
        }
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
    }, [selectedUser, addToast]);

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <UsersIcon className="w-8 h-8"/> User Management
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage all user accounts in the system.</p>
                </div>
                 <div className="flex gap-3">
                    <button 
                        onClick={handleExportCSV}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>Export CSV</span>
                    </button>
                    <button 
                        onClick={handleAddUser}
                        className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>Add New User</span>
                    </button>
                 </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard title="Total Users" value={stats.total.toString()} icon={<UsersIcon />} color="blue" />
                <StatCard title="Active Users" value={stats.active.toString()} icon={<CheckCircleIcon />} color="green" />
                <StatCard title="Pending Approval" value={stats.pending.toString()} icon={<ClockIcon />} color="yellow" />
                <StatCard title="Suspended" value={stats.suspended.toString()} icon={<AlertTriangleIcon />} color="red" />
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                        />
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <div className="relative min-w-[150px]">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                            >
                                <option value="all">All Roles</option>
                                {Object.values(UserRole).map(role => (
                                    <option key={role} value={role} className="capitalize">{role}</option>
                                ))}
                            </select>
                            <FilterIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        </div>

                        <div className="relative min-w-[150px]">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                            >
                                <option value="all">All Statuses</option>
                                {Object.values(UserStatus).map(status => (
                                    <option key={status} value={status} className="capitalize">{status}</option>
                                ))}
                            </select>
                            <FilterIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        </div>

                        {currentUserProfile?.role === UserRole.ADMIN && (
                            <div className="relative min-w-[150px]">
                                <select
                                    value={companyFilter}
                                    onChange={(e) => setCompanyFilter(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                                >
                                    <option value="all">All Companies</option>
                                    {companies.map(company => (
                                        <option key={company.id} value={company.id}>{company.name}</option>
                                    ))}
                                </select>
                                <FilterIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg dark:shadow-none transition-colors duration-300">
                 {loading ? (
                     <div className="flex justify-center items-center h-64">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                 ) : (
                    <UserManagementTable 
                        users={filteredUsers}
                        companies={companies}
                        onEdit={handleEditUser}
                        onDelete={handleDeleteUser}
                        onView={handleViewUser}
                        currentUserProfile={currentUserProfile}
                        onRoleChange={handleRoleChange}
                        updatingRoleId={updatingRoleId}
                        onCompanyChange={handleCompanyChange}
                        updatingCompanyId={updatingCompanyId}
                        onStatusChange={handleStatusChange}
                        updatingStatusId={updatingStatusId}
                    />
                 )}
            </div>

            <AddEditUserModal 
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                onSave={handleSaveUser}
                user={selectedUser}
                companies={companies}
            />

            <DeleteUserModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDeleteUser}
                userName={selectedUser ? `${selectedUser.first_name} ${selectedUser.surname}` : ''}
            />
            
            <UserDetailModal
                isOpen={!!viewUser}
                onClose={() => setViewUser(null)}
                user={viewUser}
                companyName={companies.find(c => c.id === viewUser?.company_id)?.name}
            />
        </div>
    );
};

export default UsersPage;
