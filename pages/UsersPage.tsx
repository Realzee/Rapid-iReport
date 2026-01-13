import React, { useState, useMemo } from 'react';
import { PlusIcon, UsersIcon } from '../components/icons';
import { Profile } from '../types';
import { mockUsers, mockCompanies } from '../data/mockUsers';
import UserManagementTable from '../components/UserManagementTable';
import AddEditUserModal from '../components/AddEditUserModal';
import DeleteUserModal from '../components/DeleteUserModal';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<Profile[]>(mockUsers);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

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

    const handleSaveUser = (user: Profile) => {
        if (selectedUser) {
            setUsers(users.map(u => (u.id === user.id ? user : u)));
        } else {
            setUsers([...users, { ...user, id: `u${users.length + 1}` }]);
        }
        setIsAddEditModalOpen(false);
    };

    const confirmDeleteUser = () => {
        if (selectedUser) {
            setUsers(users.filter(u => u.id !== selectedUser.id));
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
                <UserManagementTable 
                    users={filteredUsers}
                    companies={mockCompanies}
                    onEdit={handleEditUser}
                    onDelete={handleDeleteUser}
                />
            </div>

            <AddEditUserModal 
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                onSave={handleSaveUser}
                user={selectedUser}
                companies={mockCompanies}
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
