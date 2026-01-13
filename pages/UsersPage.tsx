import React, { useState, useMemo, useEffect } from 'react';
import { PlusIcon, UsersIcon } from '../components/icons';
import { Profile, Company } from '../types';
import UserManagementTable from '../components/UserManagementTable';
import AddEditUserModal from '../components/AddEditUserModal';
import DeleteUserModal from '../components/DeleteUserModal';
import { supabase } from '../utils/supabase';

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
            // 1. Update Profile Data (status, role, company, etc.)
            const { id, email, ...updateData } = userToSave;
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (profileError) {
                alert('Error updating user profile: ' + profileError.message);
            } else if (profileData) {
                setUsers(users.map(u => (u.id === profileData.id ? profileData : u)));
                alert('User profile updated successfully.');
            }

            // 2. Update Auth User Password (if provided)
            if (password) {
                /*
                    --- CRITICAL SECURITY INFORMATION ---
                    Admin actions like updating another user's password MUST be handled in a secure server environment.
                    The following code calls a Supabase Edge Function named 'update-user-password'.
                    You MUST create this function in your Supabase project for this feature to work.

                    The Edge Function should look like this:
                    -------------------------------------------
                    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

                    Deno.serve(async (req) => {
                      const { userId, password } = await req.json();
                      const supabaseAdmin = createClient(
                        Deno.env.get('SUPABASE_URL')!,
                        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                      );

                      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });

                      if (error) {
                        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                      }
                      
                      return new Response(JSON.stringify({ message: 'Password updated successfully' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                    });
                    -------------------------------------------
                */
                const { error: functionError } = await supabase.functions.invoke('update-user-password', {
                    body: { userId: userToSave.id, password: password }
                });

                if (functionError) {
                    alert(`Profile saved, but failed to update password: ${functionError.message}. Ensure the 'update-user-password' Edge Function is deployed correctly.`);
                } else {
                    alert('User password was also updated successfully.');
                }
            }
        } else { // CREATE
            if (!password) {
                alert("Password is required to create a new user.");
                return;
            }

            const { data: { session: adminSession } } = await supabase.auth.getSession();
            if (!adminSession) {
                alert("Your session has expired. Please log in again to create users.");
                return;
            }

            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: userToSave.email,
                password: password,
                options: {
                    data: {
                        full_name: userToSave.full_name,
                        role: userToSave.role,
                    }
                }
            });
            
            if (signUpError) {
                alert(`Error creating user: ${signUpError.message}`);
                await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
                return;
            }

            if (signUpData.user) {
                const { error: profileUpdateError } = await supabase
                    .from('profiles')
                    .update({
                        status: userToSave.status,
                        company_id: userToSave.company_id || null
                    })
                    .eq('id', signUpData.user.id);
                
                if (profileUpdateError) {
                    alert(`User auth record created, but failed to update profile details: ${profileUpdateError.message}`);
                }
                
                await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
                
                const { data: newProfile } = await supabase.from('profiles').select('*').eq('id', signUpData.user.id).single();
                if (newProfile) {
                    setUsers(prev => [...prev, newProfile]);
                }
            }
        }
        setIsAddEditModalOpen(false);
        setSelectedUser(null);
    };

    const confirmDeleteUser = async () => {
        if (selectedUser) {
            // Note: This only deletes the user's profile data.
            // Deleting the auth.user requires admin privileges and should be done in an Edge Function.
            const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
            if (error) {
                 alert('Error deleting user: ' + error.message);
            } else {
                setUsers(users.filter(u => u.id !== selectedUser.id));
            }
        }
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
    };

    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <UsersIcon className="w-8 h-8"/> User Management
                    </h2>
                    <p className="text-gray-400 mt-1">Manage all user accounts in the system.</p>
                </div>
                 <button 
                    onClick={handleAddUser}
                    className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Add New User</span>
                </button>
            </div>

            <div className="bg-gray-900/50 border border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm">
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