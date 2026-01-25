import React from 'react';
import { LayersIcon } from './icons';

export type MapStyle = 'street' | 'satellite';

interface MapStyleToggleProps {
    currentStyle: MapStyle;
    onStyleChange: (style: MapStyle) => void;
}

const MapStyleToggle: React.FC<MapStyleToggleProps> = ({ currentStyle, onStyleChange }) => {
    const toggleStyle = () => {
        onStyleChange(currentStyle === 'street' ? 'satellite' : 'street');
    };

    return (
        <div className="absolute top-2 right-2 z-[1000] leaflet-control">
            <button
                onClick={toggleStyle}
                className="p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-lg text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 transition-all"
                title={`Switch to ${currentStyle === 'street' ? 'satellite' : 'street'} view`}
            >
                <LayersIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export default MapStyleToggle;