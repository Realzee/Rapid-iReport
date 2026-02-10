import React, { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { Toast } from '../types';
import { CheckCircleIcon, AlertTriangleIcon, XIcon, InfoIcon } from './icons';

const toastIcons = {
    success: <CheckCircleIcon className="w-6 h-6 text-green-500" />,
    error: <AlertTriangleIcon className="w-6 h-6 text-red-500" />,
    warning: <AlertTriangleIcon className="w-6 h-6 text-yellow-500" />,
    info: <InfoIcon className="w-6 h-6 text-blue-500" />,
};

const toastStyles = {
    success: 'border-green-500/50',
    error: 'border-red-500/50',
    warning: 'border-yellow-500/50',
    info: 'border-blue-500/50',
};


const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const exitTimer = setTimeout(() => {
            setIsExiting(true);
        }, 4700); // Start exit animation slightly before removal

        const removeTimer = setTimeout(() => {
            onRemove(toast.id);
        }, 5000);

        return () => {
            clearTimeout(exitTimer);
            clearTimeout(removeTimer);
        };
    }, [toast.id, onRemove]);

    const handleManualRemove = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300); // Wait for animation
    };

    const handleClick = () => {
        if (toast.onClick) {
            toast.onClick();
            handleManualRemove(); // Also remove toast on click
        }
    };

    const enterClass = 'animate-[toast-enter_0.3s_ease-out_forwards]';
    const exitClass = 'animate-[toast-exit_0.3s_ease-in_forwards]';

    return (
        <div 
            className={`w-full max-w-sm bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 p-4 border-l-4 ${toastStyles[toast.type]} flex items-start gap-4 ${isExiting ? exitClass : enterClass} ${toast.onClick ? 'cursor-pointer' : ''}`}
            role="alert"
            onClick={toast.onClick ? handleClick : undefined}
        >
            <div className="flex-shrink-0">{toastIcons[toast.type]}</div>
            <div className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">{toast.message}</div>
            <button onClick={(e) => { e.stopPropagation(); handleManualRemove(); }} className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                <XIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useToast();

    return (
        <div className="fixed top-24 right-4 z-[9999] w-full max-w-sm space-y-3 print:hidden">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
        </div>
    );
};