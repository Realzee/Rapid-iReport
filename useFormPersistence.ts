import { useEffect, useCallback, useRef } from 'react';
import { useToast } from './contexts/ToastContext';

// A simple comparison function. Good enough for this form data.
const isDataEqual = (a: any, b: any): boolean => {
    const cleanA = JSON.parse(JSON.stringify(a || {}));
    const cleanB = JSON.parse(JSON.stringify(b || {}));
    return JSON.stringify(cleanA) === JSON.stringify(cleanB);
};

export const useFormPersistence = <T extends object>(
  formId: string,
  {
    formData,
    setFormData,
    initialData,
    isEnabled,
  }: {
    formData: T;
    setFormData: (data: T) => void;
    initialData: T;
    isEnabled: boolean;
  }
) => {
  const { addToast } = useToast();
  const debounceTimeoutRef = useRef<number | null>(null);
  const draftLoadedRef = useRef(false);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(formId);
    } catch (e) {
      console.warn(`Could not clear draft for ${formId}:`, e);
    }
  }, [formId]);
  
  const isDirty = !isDataEqual(formData, initialData);

  // 1. Load draft on mount
  useEffect(() => {
    if (!isEnabled || draftLoadedRef.current) return;
    
    try {
      const savedDraft = localStorage.getItem(formId);
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft) as T;
        if (parsedDraft && Object.keys(parsedDraft).length > 0 && !isDataEqual(parsedDraft, initialData)) {
            if (window.confirm("You have an unsaved draft. Would you like to restore it?")) {
                setFormData(parsedDraft);
                addToast("Draft restored. Please re-select any files if applicable.", "info");
            } else {
                clearDraft();
            }
        }
      }
    } catch (e) {
      console.warn(`Could not load draft for ${formId}:`, e);
    }
    draftLoadedRef.current = true;
  }, [formId, isEnabled, setFormData, addToast, clearDraft, initialData]);

  // 2. Save draft on change (debounced)
  useEffect(() => {
    if (!isEnabled) return;
    
    if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = window.setTimeout(() => {
      if (isDirty) {
        try {
          localStorage.setItem(formId, JSON.stringify(formData));
        } catch (e) {
          console.warn(`Could not save draft for ${formId}:`, e);
        }
      } else {
          clearDraft();
      }
    }, 500);
    
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [formId, formData, isEnabled, isDirty, clearDraft]);

  // 3. Navigation Guard
  useEffect(() => {
    if (!isEnabled) return;
    
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, isEnabled]);

  return { clearDraft, isDirty };
};
