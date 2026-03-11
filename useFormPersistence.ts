import { useEffect, useCallback, useRef, useState } from 'react';
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
        const parsed = JSON.parse(savedDraft);
        const parsedDraft = parsed.timestamp ? parsed.data : parsed;
        const timestamp = parsed.timestamp || 0;
        const isRecent = (Date.now() - timestamp) < 24 * 60 * 60 * 1000;

        if (parsedDraft && Object.keys(parsedDraft).length > 0 && !isDataEqual(parsedDraft, initialData)) {
            if (isRecent) {
                setFormData(parsedDraft as T);
                addToast("Restored your previous draft.", "info");
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
          const payload = {
              data: formData,
              timestamp: Date.now()
          };
          localStorage.setItem(formId, JSON.stringify(payload));
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

  const [isGuardEnabled, setIsGuardEnabled] = useState(true);

  const disableNavigationGuard = useCallback(() => {
    setIsGuardEnabled(false);
  }, []);

  // 3. Navigation Guard
  useEffect(() => {
    if (!isEnabled || !isGuardEnabled) return;
    
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
  }, [isDirty, isEnabled, isGuardEnabled]);

  return { clearDraft, isDirty, disableNavigationGuard };
};
