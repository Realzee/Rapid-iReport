
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
import ConfirmModal from '../components/ConfirmModal';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<Profile[]>(() => {
        try {
            const cached = localStorage.getItem('users_page_users');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [companies, setCompanies] = useState<Company[]>(() => {
        try {
            const cached = localStorage.getItem('users_page_companies');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(() => {
        try {
            const cached = localStorage.getItem('users_page_users');
            return !cached;
        } catch {
            return true;
        }
    });
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
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const [userReportCounts, setUserReportCounts] = useState<Record<string, number>>(() => {
        try {
            const cached = localStorage.getItem('users_page_report_counts');
            return cached ? JSON.parse(cached) : {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        try {
            if (users.length > 0) {
                localStorage.setItem('users_page_users', JSON.stringify(users));
            }
        } catch (e) {
            console.warn("Error caching UsersPage users:", e);
        }
    }, [users]);

    useEffect(() => {
        try {
            if (companies.length > 0) {
                localStorage.setItem('users_page_companies', JSON.stringify(companies));
            }
        } catch (e) {
            console.warn("Error caching UsersPage companies:", e);
        }
    }, [companies]);

    useEffect(() => {
        try {
            if (Object.keys(userReportCounts).length > 0) {
                localStorage.setItem('users_page_report_counts', JSON.stringify(userReportCounts));
            }
        } catch (e) {
            console.warn("Error caching UsersPage report counts:", e);
        }
    }, [userReportCounts]);

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

        const fetchReportCounts = async (userIds: string[]) => {
            if (userIds.length === 0) return;
            try {
                const [vRes, cRes, eRes] = await Promise.all([
                    supabase.from('vehicle_reports').select('reported_by').in('reported_by', userIds),
                    supabase.from('crime_reports').select('reported_by').in('reported_by', userIds),
                    supabase.from('emergency_reports').select('reported_by').in('reported_by', userIds)
                ]);

                const counts: Record<string, number> = {};
                
                const processReports = (reports: any[] | null) => {
                    if (!reports) return;
                    reports.forEach(r => {
                        if (r.reported_by) {
                            counts[r.reported_by] = (counts[r.reported_by] || 0) + 1;
                        }
                    });
                };

                processReports(vRes.data);
                processReports(cRes.data);
                processReports(eRes.data);

                setUserReportCounts(counts);
            } catch (error) {
                console.error("Error fetching report counts:", error);
            }
        };

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
            else {
                const fetchedUsers = usersData || [];
                setUsers(fetchedUsers);
                if (fetchedUsers.length > 0) {
                    fetchReportCounts(fetchedUsers.map(u => u.id));
                }
            }

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
                ((user as any).name || '').toLowerCase().includes(lowercasedTerm) ||
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

    const leaderboard = useMemo(() => {
        return users
            .map(u => ({ ...u, reportCount: userReportCounts[u.id] || 0 }))
            .filter(u => u.reportCount > 0)
            .sort((a, b) => b.reportCount - a.reportCount)
            .slice(0, 5);
    }, [users, userReportCounts]);

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
    
    const handleRoleChange = useCallback((userId: string, newRole: UserRole) => {
        const userObj = users.find(u => u.id === userId);
        const nameText = userObj ? `${userObj.first_name || ''} ${userObj.surname || ''}`.trim() || userObj.email : userId;
        
        setConfirmAction({
            title: 'Change User Role',
            message: `Are you sure you want to change the role of <strong>${nameText}</strong> to <strong>${newRole}</strong>?`,
            onConfirm: async () => {
                setUpdatingRoleId(userId);
                try {
                    const response = await fetch('/api/update-profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, role: newRole })
                    });

                    const contentType = response.headers.get('content-type');
                    let result;
                    if (contentType && contentType.includes('application/json')) {
                        result = await response.json();
                    } else {
                        const text = await response.text();
                        console.error('Non-JSON response received from /api/update-profile:', text);
                        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
                    }

                    if (!response.ok) {
                        throw new Error(result?.error || `Failed to update role (Status: ${response.status})`);
                    }

                    addToast(`User role updated successfully.`, 'success');
                    if (currentUserProfile) {
                        logUserAction(currentUserProfile.id, 'UPDATE_USER_ROLE', `Updated role for user ${userId} to ${newRole}`);
                    }
                } catch (error: any) {
                    addToast(`Error updating role: ${error.message}`, 'error');
                }
                setUpdatingRoleId(null);
            }
        });
    }, [addToast, currentUserProfile, users]);
    
    const handleStatusChange = useCallback((userId: string, newStatus: UserStatus) => {
        const userObj = users.find(u => u.id === userId);
        const nameText = userObj ? `${userObj.first_name || ''} ${userObj.surname || ''}`.trim() || userObj.email : userId;
        const statusMap: Record<UserStatus, string> = {
            [UserStatus.ACTIVE]: 'approve',
            [UserStatus.PENDING]: 'set to pending',
            [UserStatus.SUSPENDED]: 'suspend',
        };
        const actionVerb = statusMap[newStatus] || newStatus;

        setConfirmAction({
            title: 'Confirm User Status Change',
            message: `Are you sure you want to <strong>${actionVerb}</strong> user <strong>${nameText}</strong>?`,
            onConfirm: async () => {
                setUpdatingStatusId(userId);
                try {
                    const response = await fetch('/api/update-profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, status: newStatus })
                    });

                    const contentType = response.headers.get('content-type');
                    let result;
                    if (contentType && contentType.includes('application/json')) {
                        result = await response.json();
                    } else {
                        const text = await response.text();
                        console.error('Non-JSON response received from /api/update-profile:', text);
                        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
                    }

                    if (!response.ok) {
                        throw new Error(result?.error || `Failed to update status (Status: ${response.status})`);
                    }

                    addToast(`User status updated to ${newStatus}.`, 'success');
                    if (currentUserProfile) {
                        logUserAction(currentUserProfile.id, 'UPDATE_USER_STATUS', `Updated status for user ${userId} to ${newStatus}`);
                    }
                } catch (error: any) {
                    addToast(`Error updating status: ${error.message}`, 'error');
                }
                setUpdatingStatusId(null);
            }
        });
    }, [addToast, currentUserProfile, users]);

    const handleCompanyChange = useCallback((userId: string, newCompanyId: string | null) => {
        const userObj = users.find(u => u.id === userId);
        const nameText = userObj ? `${userObj.first_name || ''} ${userObj.surname || ''}`.trim() || userObj.email : userId;
        const companyName = companies.find(c => c.id === newCompanyId)?.name || 'None';

        setConfirmAction({
            title: 'Change User Company',
            message: `Are you sure you want to transfer <strong>${nameText}</strong> to company "<strong>${companyName}</strong>"?`,
            onConfirm: async () => {
                setUpdatingCompanyId(userId);
                try {
                    const response = await fetch('/api/update-profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, company_id: newCompanyId })
                    });

                    const contentType = response.headers.get('content-type');
                    let result;
                    if (contentType && contentType.includes('application/json')) {
                        result = await response.json();
                    } else {
                        const text = await response.text();
                        console.error('Non-JSON response received from /api/update-profile:', text);
                        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
                    }

                    if (!response.ok) {
                        throw new Error(result?.error || `Failed to update company (Status: ${response.status})`);
                    }

                    addToast(`User company updated successfully.`, 'success');
                    if (currentUserProfile) {
                        logUserAction(currentUserProfile.id, 'UPDATE_USER_COMPANY', `Updated company for user ${userId} to ${companyName}`);
                    }
                } catch (error: any) {
                    addToast(`Error updating company: ${error.message}`, 'error');
                }
                setUpdatingCompanyId(null);
            }
        });
    }, [addToast, currentUserProfile, companies, users]);

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

                const contentType = response.headers.get('content-type');
                let result;
                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    const text = await response.text();
                    console.error('Non-JSON response received from /api/update-profile:', text);
                    throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
                }

                if (!response.ok) {
                    throw new Error(result?.error || `Failed to update user profile (Status: ${response.status})`);
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

                const contentType = response.headers.get("content-type");
                let result;
                if (contentType && contentType.includes("application/json")) {
                    result = await response.json();
                } else {
                    const text = await response.text();
                    console.error("Non-JSON response received from /api/reset-password:", text);
                    addToast(`Profile saved, but password update failed with server error: ${response.status} ${response.statusText}.`, 'warning');
                    return;
                }

                if (!response.ok) {
                    addToast(`Profile saved, but password update failed: ${result?.error || 'Unknown error'}.`, 'warning');
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
            
            const response = await fetch('/api/admin-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userToSave.email, password: password, profileData: user_metadata })
            });
            
            const contentType = response.headers.get("content-type");
            let result;
            if (contentType && contentType.includes("application/json")) {
                result = await response.json();
            } else {
                const text = await response.text();
                console.error("Non-JSON response received from /api/create-user:", text);
                addToast(`Server error creating user: ${response.status} ${response.statusText}. Check console for details.`, 'error');
                return;
            }

            if (!response.ok) {
                addToast(`Error creating user: ${result?.error || 'Unknown error'}`, 'error');
                return;
            }

            const newAuthUser = result.user;
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

                    const updateContentType = profileUpdateResponse.headers.get('content-type');
                    let updateResult;
                    if (updateContentType && updateContentType.includes('application/json')) {
                        updateResult = await profileUpdateResponse.json();
                    } else {
                        const text = await profileUpdateResponse.text();
                        console.error('Non-JSON response received from /api/update-profile (linking selfie):', text);
                        throw new Error(`Server returned non-JSON response (${profileUpdateResponse.status}): ${text.substring(0, 100)}...`);
                    }

                    if (!profileUpdateResponse.ok) {
                        throw new Error(updateResult?.error || `Failed to link selfie (Status: ${profileUpdateResponse.status})`);
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
            const response = await fetch('/api/admin-users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedUser.id })
            });

            const contentType = response.headers.get("content-type");
            let result;
            if (contentType && contentType.includes("application/json")) {
                result = await response.json();
            } else {
                const text = await response.text();
                console.error("Non-JSON response received from /api/delete-user:", text);
                addToast(`Server error deleting user: ${response.status} ${response.statusText}. Check console for details.`, 'error');
                setIsDeleteModalOpen(false);
                setSelectedUser(null);
                return;
            }

            if (!response.ok) {
                addToast('Error deleting user: ' + (result?.error || 'Unknown error'), 'error');
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

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
                <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="text-yellow-500">🏆</span> Top Reporters Leaderboard
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {leaderboard.map((user, index) => (
                            <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                                    #{index + 1}
                                </div>
                                <div className="flex-shrink-0">
                                    <img className="h-10 w-10 rounded-full object-cover" src={user.avatar_url || `https://i.pravatar.cc/40?u=${user.id}`} alt="" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {user.first_name || user.surname ? `${user.first_name || ''} ${user.surname || ''}`.trim() : user.email}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {user.reportCount} reports
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                        userReportCounts={userReportCounts}
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

            {confirmAction && (
                <ConfirmModal
                    isOpen={!!confirmAction}
                    onClose={() => setConfirmAction(null)}
                    onConfirm={() => {
                        confirmAction.onConfirm();
                        setConfirmAction(null);
                    }}
                    title={confirmAction.title}
                    message={confirmAction.message}
                    confirmText="Confirm"
                />
            )}
            
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
