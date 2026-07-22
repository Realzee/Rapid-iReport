import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { XIcon } from './icons';
import { Profile } from '../types';
import { Cpu, Wifi, Shield, Gauge, Phone, Radio } from 'lucide-react';

export interface TrackingUnitFormData {
  id?: string;
  name: string;
  plate: string;
  imei: string;
  model?: string;
  sim_number?: string;
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
    model: 'Eelink TK116 (4G LTE)',
    sim_number: '',
    speed_limit: 120
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        model: initialData.model || 'Eelink TK116 (4G LTE)',
        sim_number: initialData.sim_number || ''
      });
    } else {
      setFormData({ 
        name: '', 
        plate: '', 
        imei: '', 
        model: 'Eelink TK116 (4G LTE)',
        sim_number: '',
        speed_limit: 120 
      });
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
        onSave({ ...data, sim_number: formData.sim_number, model: formData.model });
      } else {
        const { data, error: insertError } = await supabase
          .from('tracking_units')
          .insert({
            name: formData.name,
            plate: formData.plate,
            imei: formData.imei,
            speed_limit: formData.speed_limit,
            company_id: profile.company_id,
            status: 'stationary',
            lat: -26.2041,
            lng: 28.0473,
            speed: 0,
            battery_voltage: 12800,
            battery_percent: 100,
            acc_status: false,
            fuel_cut: false,
            mileage: 12000,
            fuel_level: 100
          })
          .select()
          .single();

        if (insertError) throw insertError;
        onSave({ ...data, sim_number: formData.sim_number, model: formData.model });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save tracking unit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 transition-colors">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {initialData ? 'Edit Tracking Unit' : 'Add Eelink TK116 Unit'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure GPS Tracker & Vehicle Mapping Parameters
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Vehicle / Unit Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="e.g. Patrol Cruiser 1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                License Plate
              </label>
              <input
                type="text"
                required
                value={formData.plate}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="e.g. HW 82 GP"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Hardware IMEI Number</span>
                <span className="text-[10px] text-blue-500 font-normal">15 Digits</span>
              </label>
              <input
                type="text"
                required
                value={formData.imei}
                onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                className="w-full font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="e.g. 354188046036385"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Device Model
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="Eelink TK116 (4G LTE)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                SIM Phone Number (Optional)
              </label>
              <input
                type="text"
                value={formData.sim_number}
                onChange={(e) => setFormData({ ...formData, sim_number: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="+27 82 123 4567"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Speed Limit Alert (km/h)
              </label>
              <input
                type="number"
                required
                value={formData.speed_limit}
                onChange={(e) => setFormData({ ...formData, speed_limit: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="120"
              />
            </div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <Radio className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Eelink TK116 Server Endpoint Info:</span>
              <span>Point tracker GPRS to <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded text-blue-700 dark:text-blue-300">gps.rapid911.co.za:7018</code> via SMS <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded text-blue-700 dark:text-blue-300">SERVER,1,gps.rapid911.co.za,7018,0#</code></span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

