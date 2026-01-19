import React, { useState, useMemo, useEffect } from 'react';
import { PlusIcon, UsersIcon } from '../components/icons';
import { Profile, Company, UserRole } from '../types';
import UserManagementTable from '../components/UserManagementTable';
import AddEditUserModal from '../components/AddEditUserModal';
import DeleteUserModal from '../components/DeleteUserModal';
import { supabase, supabaseAnonKey } from '../utils/supabase';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: usersData, error: usersError } = await supabase.from('profiles').select('*');
            const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*');

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
                if (payload.eventType === 'INSERT') {
                    setUsers(currentUsers => [...currentUsers, payload.new as Profile]);
                } else if (payload.eventType === 'UPDATE') {
                    setUsers(currentUsers => currentUsers.map(u => u.id === payload.new.id ? payload.new as Profile : u));
                } else if (payload.eventType === 'DELETE') {
                    setUsers(currentUsers => currentUsers.filter(u => u.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(profilesChannel);
        };
    }, []);

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
                alert('Error updating user profile: ' + profileError.message);
            } else {
                // UI will update automatically via the real-time subscription
                alert('User profile updated successfully.');
            }

            if (password) {
                const { error: functionError } = await supabase.functions.invoke('reset-password', {
                    body: { userId: userToSave.id, password: password }
                });

                if (functionError) {
                    alert(`Profile saved, but failed to update password: ${functionError.message}. Ensure the 'reset-password' Edge Function is deployed correctly.`);
                } else {
                    alert('User password was also updated successfully.');
                }
            }
        } else { // CREATE
            if (!password) {
                alert("Password is required to create a new user.");
                return;
            }

            const { error } = await supabase.functions.invoke('create-user', {
                body: {
                    email: userToSave.email,
                    password: password,
                    user_metadata: {
                        full_name: userToSave.full_name,
                        role: userToSave.role,
                        status: userToSave.status,
                        company_id: userToSave.company_id || null,
                        responder_status: userToSave.role === UserRole.RESPONDER ? userToSave.responder_status : null,
                    }
                }
            });
            
            if (error) {
                alert(`Error creating user: ${error.message}`);
                return;
            }
            // UI will update automatically via real-time subscription
            alert('User created successfully!');
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
                 alert('Error deleting user: ' + error.message);
            } else {
                // UI will update automatically via real-time subscription
                alert('User deleted successfully.');
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