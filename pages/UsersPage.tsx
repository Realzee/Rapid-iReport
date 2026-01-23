import React, { useState, useMemo, useEffect } from 'react';
import { PlusIcon, UsersIcon } from '../components/icons';
import { Profile, Company, UserRole } from '../types';
import UserManagementTable from '../components/UserManagementTable';
import AddEditUserModal from '../components/AddEditUserModal';
import DeleteUserModal from '../components/DeleteUserModal';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const { addToast } = useToast();
    const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

    useEffect(() => {
        const fetchCurrentUserProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                setCurrentUserProfile(profileData);
            } else {
                setLoading(false);
            }
        };
        fetchCurrentUserProfile();
    }, []);

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

    const filteredUsers = useMemo(() => {
        return users.filter(user =>
            user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const handleAddUser = () => {
        setSelectedUser(null);
        setIsAddEditModalOpen(true);
    };

    const handleEditUser = (user: Profile) => {
        setSelectedUser(user);
        setIsAddEditModalOpen(true);
    };

    const handleDeleteUser = (user: Profile) => {
        setSelectedUser(user);
        setIsDeleteModalOpen(true);
    };

    const handleSaveUser = async (userToSave: Profile, password?: string) => {
        if (userToSave.id) { // UPDATE
            const { id, email, ...updateData } = userToSave;
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (profileError) {
                addToast('Error updating user profile: ' + profileError.message, 'error');
            } else {
                addToast('User profile updated successfully.', 'success');
            }

            if (password) {
                const { error: functionError } = await supabase.functions.invoke('reset-password', {
                    body: { userId: userToSave.id, password: password }
                });

                if (functionError) {
                    addToast(`Profile saved, but failed to update password: ${functionError.message}. Ensure the 'reset-password' Edge Function is deployed correctly.`, 'warning');
                } else {
                    addToast('User password was also updated successfully.', 'success');
                }
            }
        } else { // CREATE
            if (!password) {
                addToast("Password is required to create a new user.", 'error');
                return;
            }

            const user_metadata: { [key: string]: any } = {
                full_name: userToSave.full_name,
                role: userToSave.role,
                status: userToSave.status,
            };

            if (userToSave.company_id) {
                user_metadata.company_id = userToSave.company_id;
            }

            if (userToSave.role === UserRole.RESPONDER && userToSave.responder_status) {
                user_metadata.responder_status = userToSave.responder_status;
            }

            const { error } = await supabase.functions.invoke('create-user', {
                body: {
                    email: userToSave.email,
                    password: password,
                    user_metadata: user_metadata
                }
            });
            
            if (error) {
                addToast(`Error creating user: ${error.message}`, 'error');
                return;
            }
            addToast('User created successfully!', 'success');
        }
        setIsAddEditModalOpen(false);
        setSelectedUser(null);
    };

    const confirmDeleteUser = async () => {
        if (selectedUser) {
            const { error } = await supabase.functions.invoke('delete-user', {
                body: { userId: selectedUser.id }
            });

            if (error) {
                 addToast('Error deleting user: ' + error.message, 'error');
            } else {
                addToast('User deleted successfully.', 'success');
            }
        }
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
    };

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
                userName={selectedUser?.full_name || ''}
            />
        </div>
    );
};

export default UsersPage;