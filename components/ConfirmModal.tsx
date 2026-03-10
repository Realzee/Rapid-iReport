import React from 'react';
import { AlertTriangleIcon } from './icons';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: 'primary' | 'danger';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = 'Confirm',
    confirmVariant = 'primary'
}) => {
    if (!isOpen) return null;

    const confirmButtonClasses = {
        primary: 'bg-blue-600 hover:bg-blue-700',
        danger: 'bg-red-600 hover:bg-red-700',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-500/20">
                    <AlertTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">{title}</h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: message }}></p>
                    </div>
                </div>
                <div className="mt-5 sm:mt-6 flex justify-center space-x-4">
                    <button
                        type="button"
                        className="inline-flex justify-center w-full rounded-md border border-blue-300 dark:border-blue-700 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-base font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none sm:text-sm"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={`inline-flex justify-center w-full rounded-md border border-transparent px-4 py-2 text-base font-medium text-white transition-colors focus:outline-none sm:text-sm ${confirmButtonClasses[confirmVariant]}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;