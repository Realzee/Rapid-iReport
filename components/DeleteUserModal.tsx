import React from 'react';
import { XIcon, AlertTriangleIcon } from './icons';

interface DeleteUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    userName: string;
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ isOpen, onClose, onConfirm, userName }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-gray-900/50 border border-gray-700/50 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-500/20">
                    <AlertTriangleIcon className="h-6 w-6 text-red-400" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-lg leading-6 font-medium text-white" id="modal-title">Delete User Account</h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-400">
                            Are you sure you want to delete the user <strong className="text-white">{userName}</strong>? This action cannot be undone.
                        </p>
                    </div>
                </div>
                <div className="mt-5 sm:mt-6 flex justify-center space-x-4">
                    <button
                        type="button"
                        className="inline-flex justify-center w-full rounded-md border border-gray-600 px-4 py-2 bg-gray-700/50 text-base font-medium text-gray-300 hover:bg-gray-700 focus:outline-none sm:text-sm"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="inline-flex justify-center w-full rounded-md border border-transparent px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-base font-medium text-white hover:scale-105 transition-transform duration-300 focus:outline-none sm:text-sm"
                        onClick={onConfirm}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteUserModal;
