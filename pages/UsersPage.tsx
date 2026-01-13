import React, { useState, useMemo, useEffect } from 'react';
import { UsersIcon } from '../components/icons';
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

    const handleEditUser = (user: Profile) => {
        setSelectedUser(user);
        setIsAddEditModalOpen(true);
    };

    const handleDeleteUser = (user: Profile) => {
        setSelectedUser(user);
        setIsDeleteModalOpen(true);
    };

    const handleSaveUser = async (userToSave: Profile) => {
        if (!userToSave.id) return; // Should not happen with "Add" button removed

        const { id, email, ...updateData } = userToSave;
        
        const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            alert('Error updating user: ' + error.message);
        } else if (data) {
            setUsers(users.map(u => (u.id === data.id ? data : u)));
            setIsAddEditModalOpen(false);
            setSelectedUser(null);
        }
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