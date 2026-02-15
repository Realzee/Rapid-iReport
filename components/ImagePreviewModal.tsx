import React from 'react';
import { XIcon } from './icons';

interface ImagePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ isOpen, onClose, imageUrl }) => {
    if (!isOpen || !imageUrl) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden" 
            onClick={onClose}
            role="dialog" 
            aria-modal="true"
        >
            <div 
                className="relative max-w-4xl max-h-[90vh] w-auto h-auto" 
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={onClose} 
                    className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors" 
                    title="Close preview"
                >
                    <XIcon className="w-6 h-6" />
                </button>
                <img 
                    src={imageUrl} 
                    alt="Evidence preview" 
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                />
            </div>
        </div>
    );
};

export default ImagePreviewModal;
