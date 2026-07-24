import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { Profile, UserRole, LocationCoords } from '../types';
import { useToast } from '../contexts/ToastContext';

interface TechDispatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    allUsers: Profile[];
    onJobDispatched: () => void;
}

const TechDispatchModal: React.FC<TechDispatchModalProps> = ({
    isOpen,
    onClose,
    allUsers,
    onJobDispatched
}) => {
    const { addToast } = useToast();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
    const [location, setLocation] = useState('');
    const [lat, setLat] = useState(-26.2041);
    const [lng, setLng] = useState(28.0473);
    const [assignedTo, setAssignedTo] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Filter to technicians
    const technicians = allUsers.filter(u => u.role === UserRole.TECHNICIAN);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            addToast('Please enter a job title.', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const coords: LocationCoords = { lat, lng };
            const { error } = await supabase
                .from('tech_jobs')
                .insert({
                    title: title.trim(),
                    description: description.trim(),
                    severity,
                    location: location.trim(),
                    location_coords: coords,
                    assigned_to: assignedTo || null,
                    status: assignedTo ? 'assigned' : 'pending',
                });

            if (error) throw error;

            addToast('Technician work order successfully dispatched!', 'success');
            setTitle('');
            setDescription('');
            setLocation('');
            setAssignedTo('');
            onJobDispatched();
            onClose();
        } catch (err: any) {
            console.error('Error dispatching job:', err);
            addToast('Failed to dispatch technical work order.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    title="Close Dialog"
                >
                    ✕
                </button>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">
                    🔧 Dispatch Technical Job
                </h2>
                <p className="text-xs text-gray-500 mb-5">
                    Establish a secure work order and route it directly to a qualified technician.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-750 dark:text-gray-300 uppercase mb-1">
                            Job Context / Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Vehicle Tracker Installation / Server Room UPS"
                            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-750 dark:text-gray-300 uppercase mb-1">
                            Description / Requirements
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Detail instructions, tools required, or diagnostics details..."
                            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white h-24 focus:outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-750 dark:text-gray-300 uppercase mb-1">
                                Priority Level
                            </label>
                            <select
                                value={severity}
                                onChange={e => setSeverity(e.target.value as any)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none uppercase font-bold"
                            >
                                <option value="low" className="uppercase font-bold">LOW</option>
                                <option value="medium" className="uppercase font-bold">MEDIUM</option>
                                <option value="high" className="uppercase font-bold">HIGH</option>
                                <option value="critical" className="uppercase font-bold">CRITICAL</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-750 dark:text-gray-300 uppercase mb-1">
                                Assign Technician
                            </label>
                            <select
                                value={assignedTo}
                                onChange={e => setAssignedTo(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                            >
                                <option value="">Select Technician (Or Leave Pending)</option>
                                {technicians.map(tech => (
                                    <option key={tech.id} value={tech.id}>
                                        {tech.first_name} {tech.surname} (Online)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-750 dark:text-gray-300 uppercase mb-1">
                            Site Address / Location
                        </label>
                        <input
                            type="text"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            placeholder="e.g. Block B, Ground Floor Radio Tower Grid"
                            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-750 dark:text-gray-300 uppercase mb-1">Latitude</label>
                            <input
                                type="number"
                                step="any"
                                value={lat}
                                onChange={e => setLat(parseFloat(e.target.value) || -26.2041)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-750 dark:text-gray-300 uppercase mb-1">Longitude</label>
                            <input
                                type="number"
                                step="any"
                                value={lng}
                                onChange={e => setLng(parseFloat(e.target.value) || 28.0473)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-250 font-bold text-xs rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition"
                        >
                            {submitting ? 'Dispatching...' : 'Dispatch Job'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TechDispatchModal;
