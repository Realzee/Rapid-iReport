import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { Toast, ToastType } from '../types';

interface ToastContextType {
  addToast: (message: string, type: ToastType, durationOrOnClick?: number | (() => void), onClick?: () => void) => void;
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((
    message: string, 
    type: ToastType, 
    durationOrOnClick?: number | (() => void), 
    onClick?: () => void
  ) => {
    const id = crypto.randomUUID();
    
    let duration = 3000;
    let finalOnClick = onClick;

    if (typeof durationOrOnClick === 'number') {
        duration = durationOrOnClick;
    } else if (typeof durationOrOnClick === 'function') {
        finalOnClick = durationOrOnClick;
    }

    setToasts(currentToasts => [...currentToasts, { id, message, type, onClick: finalOnClick }]);

    if (duration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};