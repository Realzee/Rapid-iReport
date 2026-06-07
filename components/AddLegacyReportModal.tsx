import React, { useState } from 'react';
import { XIcon } from './icons';

interface AddLegacyReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    report?: any; // If provided, we are in Edit mode
    profile?: any;
}

const AddLegacyReportModal: React.FC<AddLegacyReportModalProps> = ({ isOpen, onClose, onSuccess, report, profile }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getCompanyAlias = () => {
        return profile?.company?.alias || profile?.company?.name || '';
    };

    const getCompanyName = () => {
        return profile?.company?.name || '';
    };

    const [formData, setFormData] = useState({
        type: report?.type || 'STOLEN VEHICLE',
        company: report?.company || getCompanyAlias(),
        vehicle_registration: report?.license_plate || '',
        make: report?.vehicle_make || '',
        model: report?.vehicle_model || '',
        vin_number: report?.vin_number || '',
        engine_number: report?.engine_number || '',
        color: report?.vehicle_color || '',
        reason: report?.description?.replace('[LEGACY SYSTEM REPORT]\n', '') || '',
        entry_text: report?.entry_text || '',
        cos_name: report?.cos_name || getCompanyName(),
        cos_contact_number: report?.cos_contact_number || '',
        case_number: report?.cas_number || '',
        station_reported_at: report?.station_name || '',
        io_name: report?.io_name || '',
        io_contact: report?.io_contact || '',
        recovered: report?.status === 'recovered' ? 'RECOVERED' : (report?.status ? report.status.toUpperCase() : 'STOLEN'),
        tracker: report?.has_tracker ? 'Yes' : 'No',
        date_of_incident: report?.reported_at ? new Date(report.reported_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });

    // Reset form when report changes or profile loads
    React.useEffect(() => {
        if (report) {
            setFormData({
                type: report.type || 'STOLEN VEHICLE',
                company: report.company || getCompanyAlias(),
                vehicle_registration: report.license_plate || '',
                make: report.vehicle_make || '',
                model: report.vehicle_model || '',
                vin_number: report.vin_number || '',
                engine_number: report.engine_number || '',
                color: report.vehicle_color || '',
                reason: report.description?.replace('[LEGACY SYSTEM REPORT]\n', '') || '',
                entry_text: report.entry_text || '',
                cos_name: report.cos_name || getCompanyName(),
                cos_contact_number: report.cos_contact_number || '',
                case_number: report.cas_number || '',
                station_reported_at: report.station_name || '',
                io_name: report.io_name || '',
                io_contact: report.io_contact || '',
                recovered: report.status === 'recovered' ? 'RECOVERED' : (report.status ? report.status.toUpperCase() : 'STOLEN'),
                tracker: report.has_tracker ? 'Yes' : 'No',
                date_of_incident: report.reported_at ? new Date(report.reported_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            });
        } else {
            setFormData({
                type: 'STOLEN VEHICLE',
                company: getCompanyAlias(),
                vehicle_registration: '',
                make: '',
                model: '',
                vin_number: '',
                engine_number: '',
                color: '',
                reason: '',
                entry_text: '',
                cos_name: getCompanyName(),
                cos_contact_number: '',
                case_number: '',
                station_reported_at: '',
                io_name: '',
                io_contact: '',
                recovered: 'STOLEN',
                tracker: '',
                date_of_incident: new Date().toISOString().split('T')[0]
            });
        }
    }, [report, profile]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const action = report ? 'edit' : 'add';
            const payload = report ? { ...formData, id: report.id } : formData;

            const res = await fetch('/api/legacy-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload })
            });

            if (!res.ok) {
                let errorMessage = `Failed to ${action} report (Status: ${res.status})`;
                try {
                    const data = await res.json();
                    errorMessage = data.message || data.error || errorMessage;
                } catch (e) {
                    // If not JSON, try to get text
                    const text = await res.text().catch(() => '');
                    if (text && text.length < 500) {
                        // Strip HTML tags if possible for a cleaner message
                        errorMessage = text.replace(/<[^>]*>/g, ' ').substring(0, 200).trim();
                    }
                }
                throw new Error(errorMessage);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'An error occurred while communicating with the legacy server.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:p-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {report ? 'Edit' : 'Add New'} Legacy Vehicle Log
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <form id="legacyAddForm" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dossier Type *</label>
                                <select name="type" required value={formData.type} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                                    <option value="STOLEN VEHICLE">STOLEN VEHICLE</option>
                                    <option value="HIJACKING">HIJACKING</option>
                                    <option value="THEFT OUT OF MOTOR VEHICLE">THEFT OUT OF MOTOR VEHICLE</option>
                                    <option value="RECOVERY LOG">RECOVERY LOG</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reporting Company Alias *</label>
                                <input type="text" name="company" required placeholder="E.G. ADVANCED OST" value={formData.company} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registration Number *</label>
                                <input type="text" name="vehicle_registration" required placeholder="e.g., KT13XDGP" value={formData.vehicle_registration} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Make *</label>
                                <input type="text" name="make" required placeholder="e.g., TOYOTA" value={formData.make} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model *</label>
                                <input type="text" name="model" required placeholder="e.g., HILUX GD6" value={formData.model} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color *</label>
                                <input type="text" name="color" required placeholder="e.g., MATTE WHITE" value={formData.color} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">VIN Number</label>
                                <input type="text" name="vin_number" placeholder="ENTER VIN..." value={formData.vin_number} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Engine Number</label>
                                <input type="text" name="engine_number" placeholder="ENTER ENGINE NO..." value={formData.engine_number} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operational Status *</label>
                                <select name="recovered" required value={formData.recovered} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                                    <option value="STOLEN">STOLEN</option>
                                    <option value="RECOVERED">RECOVERED</option>
                                    <option value="PENDING">PENDING</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">COS (Complainant) Name *</label>
                                <input type="text" name="cos_name" required placeholder="FULL NAME" value={formData.cos_name} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">COS Contact Number *</label>
                                <input type="text" name="cos_contact_number" required placeholder="e.g., 0821234567" value={formData.cos_contact_number} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SAPS Case Number *</label>
                                <input type="text" name="case_number" required placeholder="e.g., CAS 112/05/2026" value={formData.case_number} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Station Reported At *</label>
                                <input type="text" name="station_reported_at" required placeholder="e.g., Brooklyn SAPS" value={formData.station_reported_at} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IO (Investigating Officer) Name *</label>
                                <input type="text" name="io_name" required placeholder="INVESTIGATING OFFICER" value={formData.io_name} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IO Contact *</label>
                                <input type="text" name="io_contact" required placeholder="OFFICER PHONE" value={formData.io_contact} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tracker *</label>
                                <input type="text" name="tracker" required placeholder="e.g., CARTRACK / MATRIX" value={formData.tracker} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Incident *</label>
                                <input type="date" name="date_of_incident" required value={formData.date_of_incident} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (Indicators / Identification) *</label>
                                <textarea name="reason" required placeholder="Input physical/technical identification indicators..." value={formData.reason} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Entry Log Narrative (Operational Support Notes) *</label>
                                <textarea name="entry_text" required placeholder="Detail operational response notes..." value={formData.entry_text} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 sticky bottom-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="legacyAddForm"
                        disabled={loading}
                        className="px-6 py-2 font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                        Save Legacy Entry
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddLegacyReportModal;
