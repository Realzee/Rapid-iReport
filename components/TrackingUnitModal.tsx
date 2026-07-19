import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { XIcon } from './icons';
import { Profile } from '../types';

export interface TrackingUnitFormData {
  id?: string;
  name: string;
  plate: string;
  imei: string;
  speed_limit: number;
}

interface Props {
  profile: Profile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (unit: any) => void;
  initialData?: TrackingUnitFormData | null;
}

export const TrackingUnitModal: React.FC<Props> = ({ profile, isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<TrackingUnitFormData>({
    name: '',
    plate: '',
    imei: '',
    speed_limit: 100
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({ name: '', plate: '', imei: '', speed_limit: 100 });
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (initialData?.id) {
        const { data, error: updateError } = await supabase
          .from('tracking_units')
          .update({
            name: formData.name,
            plate: formData.plate,
            imei: formData.imei,
            speed_limit: formData.speed_limit,
            updated_at: new Date().toISOString()
          })
          .eq('id', initialData.id)
          .select()
          .single();

        if (updateError) throw updateError;
        onSave(data);
      } else {
        const { data, error: insertError } = await supabase
          .from('tracking_units')
          .insert({
            name: formData.name,
            plate: formData.plate,
            imei: formData.imei,
            speed_limit: formData.speed_limit,
            company_id: profile.company_id
          })
          .select()
          .single();

        if (insertError) throw insertError;
        onSave(data);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save tracking unit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {initialData ? 'Edit Tracking Unit' : 'Add Tracking Unit'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="text-red-500 text-sm">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Unit Name / Alias</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              placeholder="e.g. Patrol Vehicle 1"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">License Plate</label>
            <input
              type="text"
              required
              value={formData.plate}
              onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              placeholder="e.g. AB 123 CD"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">IMEI Number</label>
            <input
              type="text"
              required
              value={formData.imei}
              onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              placeholder="15-digit IMEI"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Speed Limit (km/h)</label>
            <input
              type="number"
              required
              value={formData.speed_limit}
              onChange={(e) => setFormData({ ...formData, speed_limit: parseInt(e.target.value) || 0 })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              placeholder="e.g. 100"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
