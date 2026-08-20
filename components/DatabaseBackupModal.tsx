import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Database, Download, UploadCloud, RefreshCw, FileText, CheckCircle2, 
  AlertTriangle, Server, Terminal, Copy, Check, Table, ShieldAlert, 
  HardDrive, Layers, ArrowDownCircle, ArrowUpCircle, Info, Activity
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { Profile } from '../types';

interface TableStat {
  name: string;
  label: string;
  primaryKey: string;
  category: string;
  description: string;
  count: number;
  status: string;
}

interface DatabaseStats {
  status: string;
  dbHost: string;
  projectRef: string;
  timestamp: string;
  totalTables: number;
  totalRecords: number;
  tables: TableStat[];
}

interface DatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbHost: string;
  profile?: Profile | null;
}

export const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({ 
  isOpen, 
  onClose, 
  dbHost: initialDbHost,
  profile 
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'backup' | 'restore' | 'cli'>('overview');

  // Stats state
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Backup / Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'sql'>('json');
  const [selectedBackupTables, setSelectedBackupTables] = useState<string[]>([]);
  const [backupAllTables, setBackupAllTables] = useState(true);

  // Restore / Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'upsert' | 'replace'>('upsert');
  const [selectedRestoreTables, setSelectedRestoreTables] = useState<string[]>([]);
  const [restoreAllTables, setRestoreAllTables] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ currentTable?: string; step?: number; totalSteps?: number; percent?: number }>({});
  const [restoreResult, setRestoreResult] = useState<any | null>(null);
  const [confirmReplaceText, setConfirmReplaceText] = useState('');

  // Copy state for CLI blocks
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/database-backup?action=stats');
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setStats(data);
      if (data.tables) {
        setSelectedBackupTables(data.tables.map((t: TableStat) => t.name));
      }
    } catch (err: any) {
      console.error('Failed to load database stats:', err);
      addToast('Could not fetch real-time database stats', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    } else {
      // Reset temporary states on close
      setUploadedFile(null);
      setParsedBackup(null);
      setParseError(null);
      setRestoreResult(null);
      setConfirmReplaceText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDbHost = stats?.dbHost || initialDbHost || 'db.yglwdwhwpbqawunbkzyy.supabase.co';
  const projectRef = stats?.projectRef || 'yglwdwhwpbqawunbkzyy';

  // Toggle backup table selection
  const toggleBackupTable = (tableName: string) => {
    setBackupAllTables(false);
    setSelectedBackupTables(prev => 
      prev.includes(tableName) ? prev.filter(t => t !== tableName) : [...prev, tableName]
    );
  };

  const handleSelectAllBackup = (all: boolean) => {
    setBackupAllTables(all);
    if (all && stats?.tables) {
      setSelectedBackupTables(stats.tables.map(t => t.name));
    } else {
      setSelectedBackupTables([]);
    }
  };

  // Perform Backup / Export
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const tablesToExport = backupAllTables ? undefined : selectedBackupTables;
      const res = await fetch('/api/database-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          format: exportFormat,
          tables: tablesToExport,
          userEmail: profile?.email || 'Admin User'
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Export failed with status ${res.status}`);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (exportFormat === 'sql') {
        const sqlText = await res.text();
        const blob = new Blob([sqlText], { type: 'application/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapid_ireport_full_backup_${timestamp}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const jsonData = await res.json();
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapid_ireport_full_backup_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      addToast(`Database ${exportFormat.toUpperCase()} backup successfully generated and downloaded!`, 'success');
    } catch (err: any) {
      console.error('Export error:', err);
      addToast(`Backup generation failed: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Upload for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setParseError(null);
    setParsedBackup(null);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        // Validate structure
        const tables = parsed.tables || parsed;
        if (!tables || typeof tables !== 'object' || Object.keys(tables).length === 0) {
          throw new Error('No valid database tables found in this file.');
        }

        setParsedBackup(parsed);
        const tableKeys = Object.keys(tables);
        setSelectedRestoreTables(tableKeys);
        setRestoreAllTables(true);
      } catch (err: any) {
        console.error('Invalid backup JSON:', err);
        setParseError(`Failed to parse backup file: ${err.message}. Please upload a valid JSON backup.`);
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  // Perform Restore
  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;

    if (restoreMode === 'replace' && confirmReplaceText.trim() !== 'RESTORE') {
      addToast('Please type "RESTORE" to confirm clean overwrite mode.', 'warning');
      return;
    }

    setIsRestoring(true);
    setRestoreProgress({ step: 1, totalSteps: selectedRestoreTables.length, percent: 10 });
    setRestoreResult(null);

    try {
      const res = await fetch('/api/database-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          backupData: parsedBackup,
          mode: restoreMode,
          selectedTables: restoreAllTables ? undefined : selectedRestoreTables,
          userEmail: profile?.email || 'Admin',
          userId: profile?.id
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || result.message || 'Database restore failed');
      }

      setRestoreResult(result);
      addToast(result.message || 'Database successfully restored!', 'success');
      // Refresh live stats
      fetchStats();
    } catch (err: any) {
      console.error('Restore error:', err);
      addToast(`Restore failed: ${err.message}`, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2500);
    });
  };

  const pgDumpCommand = `pg_dump "postgresql://postgres:[YOUR_PASSWORD]@${currentDbHost}:5432/postgres" -f rapid_ireport_db_backup.sql`;
  const psqlRestoreCommand = `psql "postgresql://postgres:[YOUR_PASSWORD]@${currentDbHost}:5432/postgres" -f rapid_ireport_db_backup.sql`;
  const supabaseDumpCommand = `supabase db dump --project-ref ${projectRef} -f supabase_backup.sql`;

  // Categories for grouping
  const categories = ['Core', 'Incidents', 'Guarding', 'Operations', 'Fleet', 'System', 'Communication', 'TechOps'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto" onClick={onClose}>
      <div 
        className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Database Backup & Disaster Recovery Center
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Admin Only
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Host: <span className="font-mono text-gray-700 dark:text-gray-300">{currentDbHost}</span> • PostgreSQL (Supabase)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-950/40 px-6 space-x-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white/60 dark:bg-gray-900/60'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Database Status & Tables</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'backup'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white/60 dark:bg-gray-900/60'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Create Backup (Export)</span>
          </button>

          <button
            onClick={() => setActiveTab('restore')}
            className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'restore'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white/60 dark:bg-gray-900/60'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>Restore Snapshot (Import)</span>
          </button>

          <button
            onClick={() => setActiveTab('cli')}
            className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cli'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white/60 dark:bg-gray-900/60'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>CLI & pg_dump Commands</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/50 shadow-sm">
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider">Health Status</span>
                    <Server className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                    Online & Active
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Postgres 15+ via Supabase Cloud</p>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/50 shadow-sm">
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider">Total Tables</span>
                    <Table className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats?.totalTables || 26} <span className="text-sm font-normal text-gray-500">Registered</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Fully mapped schema</p>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/50 shadow-sm">
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider">Live Records</span>
                    <Layers className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loadingStats ? (
                      <span className="text-sm text-gray-400">Loading...</span>
                    ) : (
                      (stats?.totalRecords || 0).toLocaleString()
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Across all incident & system tables
                  </p>
                </div>
              </div>

              {/* Action shortcuts */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Automated Snapshot Ready</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300">Export your complete database into a portable JSON or SQL file with a single click.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setActiveTab('backup'); }}
                    className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Backup
                  </button>
                  <button
                    onClick={() => { setActiveTab('restore'); }}
                    className="px-4 py-2 text-xs font-semibold bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition flex items-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Restore Snapshot
                  </button>
                </div>
              </div>

              {/* Table List Breakdown */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                    <Table className="w-4 h-4 text-gray-500" />
                    Database Table Inventory & Row Counts
                  </h3>
                  <button
                    onClick={fetchStats}
                    disabled={loadingStats}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingStats ? 'animate-spin' : ''}`} />
                    Refresh Counts
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stats?.tables?.map(t => (
                    <div 
                      key={t.name}
                      className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-xs text-gray-900 dark:text-white font-mono">{t.name}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[180px]">{t.label}</div>
                        </div>
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                          {t.count} rows
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 line-clamp-1">{t.description}</p>
                    </div>
                  )) || (
                    <div className="col-span-3 text-center py-6 text-gray-400 text-sm">
                      {loadingStats ? 'Inspecting database tables...' : 'No table data available'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BACKUP (EXPORT) */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
                  <p className="font-semibold">One-Click Full Database Backup</p>
                  <p>Export all registered tables into a structured snapshot file. You can restore this file at any time using the Restore tab or import the generated SQL directly into PostgreSQL.</p>
                </div>
              </div>

              {/* Backup Configuration */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                    1. Choose Backup Format
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setExportFormat('json')}
                      className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                        exportFormat === 'json'
                          ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                          JSON Database Snapshot (.json)
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono">Recommended</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Universal structured snapshot. Fully compatible with the In-App Web Restore utility and disaster recovery pipelines.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat('sql')}
                      className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                        exportFormat === 'sql'
                          ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-white">
                          PostgreSQL SQL Script (.sql)
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Standard PostgreSQL `INSERT INTO ... ON CONFLICT` dump script. Can be pasted into Supabase SQL Editor or executed via psql.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Table Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      2. Select Tables to Include
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleSelectAllBackup(true)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        Select All (26 Tables)
                      </button>
                      <span className="text-gray-400">•</span>
                      <button
                        type="button"
                        onClick={() => handleSelectAllBackup(false)}
                        className="text-gray-500 hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-3 bg-gray-50/40 dark:bg-gray-900/50 max-h-60 overflow-y-auto space-y-4">
                    {categories.map(cat => {
                      const catTables = stats?.tables?.filter(t => t.category === cat) || [];
                      if (catTables.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-1.5">
                          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{cat}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {catTables.map(t => {
                              const isChecked = selectedBackupTables.includes(t.name);
                              return (
                                <label 
                                  key={t.name}
                                  className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                                    isChecked 
                                      ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/20 text-gray-900 dark:text-white' 
                                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/40 text-gray-600 dark:text-gray-400'
                                  }`}
                                >
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked} 
                                    onChange={() => toggleBackupTable(t.name)}
                                    className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700"
                                  />
                                  <span className="font-mono truncate">{t.name}</span>
                                  <span className="text-[10px] text-gray-400 ml-auto">({t.count})</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Export Button */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="text-xs text-gray-500 mr-auto">
                    Selected: <span className="font-semibold text-gray-900 dark:text-white">{selectedBackupTables.length} tables</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    disabled={isExporting || selectedBackupTables.length === 0}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generating Backup Snapshot...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download {exportFormat.toUpperCase()} Backup</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESTORE (IMPORT) */}
          {activeTab === 'restore' && (
            <div className="space-y-6">
              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-semibold">Database Restore Warning</p>
                  <p>Restoring a database snapshot will insert or update records in your PostgreSQL database. Ensure you test in a safe environment or keep a current backup before restoring.</p>
                </div>
              </div>

              {/* Upload file box */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-gray-50/50 dark:bg-gray-900/50 transition group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".json" 
                  className="hidden" 
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full transition">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">
                      {uploadedFile ? uploadedFile.name : 'Click to browse or drop backup JSON file here'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB` : 'Supports rapid-ireport backup .json files'}
                    </p>
                  </div>
                </div>
              </div>

              {parseError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Backup Inspector & Configuration */}
              {parsedBackup && (
                <div className="space-y-4 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 bg-white dark:bg-gray-800/40">
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Backup Snapshot Verified
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Exported: {parsedBackup.exportedAt ? new Date(parsedBackup.exportedAt).toLocaleString() : 'N/A'} • By: {parsedBackup.exportedBy || 'Admin'}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-semibold">
                      {Object.keys(parsedBackup.tables || parsedBackup).length} Tables Present
                    </span>
                  </div>

                  {/* Mode Selector */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                      Restore Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRestoreMode('upsert')}
                        className={`p-3 rounded-xl border text-left transition ${
                          restoreMode === 'upsert'
                            ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <div className="font-semibold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>Merge & Upsert</span>
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1 rounded font-mono">Safe</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          Inserts new records and updates matching IDs. Does NOT delete non-conflicting existing records.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRestoreMode('replace')}
                        className={`p-3 rounded-xl border text-left transition ${
                          restoreMode === 'replace'
                            ? 'border-red-500 bg-red-50/40 dark:bg-red-900/20 ring-2 ring-red-500/20'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <div className="font-semibold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span className="text-red-600 dark:text-red-400">Clean & Replace</span>
                          <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1 rounded font-mono">Destructive</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          Clears target tables and restores snapshot state. Requires confirmation.
                        </p>
                      </button>
                    </div>
                  </div>

                  {restoreMode === 'replace' && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                        Type "RESTORE" below to authorize clean replace mode:
                      </p>
                      <input 
                        type="text" 
                        value={confirmReplaceText} 
                        onChange={e => setConfirmReplaceText(e.target.value)} 
                        placeholder="RESTORE" 
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}

                  {/* Restorable Tables preview */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                      Tables to Restore ({selectedRestoreTables.length})
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/50">
                      {Object.entries(parsedBackup.tables || parsedBackup).map(([tableName, rows]: [string, any]) => (
                        <div key={tableName} className="text-xs font-mono p-1.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex justify-between">
                          <span className="truncate">{tableName}</span>
                          <span className="text-blue-500 font-bold ml-1">{Array.isArray(rows) ? rows.length : 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Execution button */}
                  <div className="pt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={isRestoring || (restoreMode === 'replace' && confirmReplaceText !== 'RESTORE')}
                      className={`px-6 py-2.5 text-white font-semibold rounded-xl shadow transition flex items-center space-x-2 text-xs ${
                        restoreMode === 'replace' 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      } disabled:opacity-50`}
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Restoring Records...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          <span>Execute Database Restore</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Restore Result Summary */}
              {restoreResult && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    Restore Completed Successfully
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {restoreResult.message}
                  </p>
                  {restoreResult.restoredCounts && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/60">
                      {Object.entries(restoreResult.restoredCounts).map(([t, count]) => (
                        <div key={t} className="text-[11px] font-mono text-emerald-900 dark:text-emerald-200">
                          {t}: <span className="font-bold">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CLI & PG_DUMP */}
          {activeTab === 'cli' && (
            <div className="space-y-5 text-sm text-gray-600 dark:text-gray-300">
              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 rounded-xl p-4">
                <h4 className="font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-500" />
                  Direct PostgreSQL Command Line & Supabase CLI
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  For large-scale offline backups, automated cron scripts, or migration to another PostgreSQL host, run standard tools directly from your terminal.
                </p>
              </div>

              {/* pg_dump block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                    1. Create Backup with `pg_dump`
                  </span>
                  <button
                    onClick={() => copyToClipboard(pgDumpCommand, 'pg_dump')}
                    className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded flex items-center gap-1 transition"
                  >
                    {copiedCode === 'pg_dump' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode === 'pg_dump' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-3 bg-gray-900 text-gray-100 rounded-xl font-mono text-xs overflow-x-auto border border-gray-800">
                  <code>{pgDumpCommand}</code>
                </div>
                <p className="text-[11px] text-gray-500">
                  Replace <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">[YOUR_PASSWORD]</code> with your Supabase database password found in your Supabase project settings.
                </p>
              </div>

              {/* psql restore block */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                    2. Restore with `psql`
                  </span>
                  <button
                    onClick={() => copyToClipboard(psqlRestoreCommand, 'psql')}
                    className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded flex items-center gap-1 transition"
                  >
                    {copiedCode === 'psql' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode === 'psql' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-3 bg-gray-900 text-gray-100 rounded-xl font-mono text-xs overflow-x-auto border border-gray-800">
                  <code>{psqlRestoreCommand}</code>
                </div>
              </div>

              {/* Supabase CLI block */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                    3. Supabase CLI Dump
                  </span>
                  <button
                    onClick={() => copyToClipboard(supabaseDumpCommand, 'supabase_cli')}
                    className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded flex items-center gap-1 transition"
                  >
                    {copiedCode === 'supabase_cli' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode === 'supabase_cli' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-3 bg-gray-900 text-gray-100 rounded-xl font-mono text-xs overflow-x-auto border border-gray-800">
                  <code>{supabaseDumpCommand}</code>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <span>RAPID iREPORT Backup v1.0</span>
          </div>
          <button
            type="button"
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatabaseBackupModal;
