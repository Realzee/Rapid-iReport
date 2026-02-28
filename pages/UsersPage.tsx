
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PlusIcon, UsersIcon } from '../components/icons';
import { Profile, Company, UserRole, UserStatus } from '../types';
import UserManagementTable from '../components/UserManagementTable';
import AddEditUserModal from '../components/AddEditUserModal';
import DeleteUserModal from '../components/DeleteUserModal';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import UserDetailModal from '../components/UserDetailModal';

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
        const lowercasedTerm = debouncedSearchTerm.toLowerCase();
        if (!lowercasedTerm) return users;
        return users.filter(user =>
            (user.first_name || '').toLowerCase().includes(lowercasedTerm) ||
            (user.surname || '').toLowerCase().includes(lowercasedTerm) ||
            user.email.toLowerCase().includes(lowercasedTerm)
        );
    }, [users, debouncedSearchTerm]);

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
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            addToast(`Error updating role: ${error.message}`, 'error');
        } else {
            addToast(`User role updated successfully.`, 'success');
        }
        setUpdatingRoleId(null);
    }, [addToast]);
    
    const handleStatusChange = useCallback(async (userId: string, newStatus: UserStatus) => {
        setUpdatingStatusId(userId);
        const { error } = await supabase
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', userId);

        if (error) {
            addToast(`Error updating status: ${error.message}`, 'error');
        } else {
            addToast(`User status updated to ${newStatus}.`, 'success');
        }
        setUpdatingStatusId(null);
    }, [addToast]);

    const handleCompanyChange = useCallback(async (userId: string, newCompanyId: string | null) => {
        setUpdatingCompanyId(userId);
        const { error } = await supabase
            .from('profiles')
            .update({ company_id: newCompanyId })
            .eq('id', userId);

        if (error) {
            addToast(`Error updating company: ${error.message}`, 'error');
        } else {
            addToast(`User company updated successfully.`, 'success');
        }
        setUpdatingCompanyId(null);
    }, [addToast]);

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
            const { error: profileError } = await supabase.from('profiles').update(updateData).eq('id', id);

            if (profileError) {
                addToast('Error updating user profile: ' + profileError.message, 'error');
            } else {
                addToast('User profile updated successfully.', 'success');
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
                const { error: profileUpdateError } = await supabase
                    .from('profiles')
                    .update({ avatar_url: `${urlData.publicUrl}?t=${new Date().getTime()}` })
                    .eq('id', newAuthUser.id);
                
                if(profileUpdateError) {
                     addToast(`User created, but linking selfie failed: ${profileUpdateError.message}`, 'warning');
                } else {
                    addToast('User created successfully!', 'success');
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
            }
        }
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
    }, [selectedUser, addToast]);

    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <UsersIcon className="w-8 h-8"/> User Management
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage all user accounts in the system.</p>
                </div>
                 <button 
                    onClick={handleAddUser}
                    className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Add New User</span>
                </button>
            </div>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-sm bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg py-2 px-4"
                />
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
