import React, { useState } from 'react';
import { 
    XIcon, 
    HistoryIcon, 
    SearchIcon, 
    Sparkles, 
    CheckCircle2, 
    Tag, 
    Calendar, 
    ShieldAlert, 
    Ambulance, 
    Wrench, 
    Building2, 
    Filter,
    ArrowUpRight,
    HeartPulse
} from 'lucide-react';

interface ChangeLogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ReleaseItem {
    id: string;
    version: string;
    date: string;
    badge: string;
    badgeColor: string;
    title: string;
    summary: string;
    highlights: {
        category: 'EMS & Medical' | 'Guarding & Patrols' | 'Tech Ops & Drivers' | 'Branding & Admin' | 'Reporting & Security';
        title: string;
        description: string;
        isNew?: boolean;
    }[];
}

const RELEASES: ReleaseItem[] = [
    {
        id: 'rel-3.5.0',
        version: 'v3.5.0',
        date: 'September 2026',
        badge: 'Current Version',
        badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        title: 'Dispatch Queue Persistence, Responsive Duty Toggle & Automated Incident Lifecycle',
        summary: 'Enhanced dispatch queue stability with persistent call claiming, responsive Active Duty status toggling, and automated queue clearing upon call resolution.',
        highlights: [
            {
                category: 'EMS & Medical',
                title: 'Persistent Call Claiming & Queue Synchronization',
                description: 'Claimed emergency dispatches, EMS medical calls, roadside callouts, and crime reports now maintain strict responder ownership across data refreshes and status updates without reverting to unassigned queues.',
                isNew: true
            },
            {
                category: 'Tech Ops & Drivers',
                title: 'Responsive Active Duty Status & Engagement Control',
                description: 'Optimized duty status toggling with instant optimistic state updates. The engagement lock now strictly checks responder-assigned active calls rather than system-wide open dispatches.',
                isNew: true
            },
            {
                category: 'Reporting & Security',
                title: 'Automated Incident Queue Clearing',
                description: 'Dispatches are instantly unassigned and cleared from active dispatch lists upon reaching terminal states (Resolved, Recovered, Closed). The detail view automatically advances to remaining active incidents.',
                isNew: true
            }
        ]
    },
    {
        id: 'rel-3.4.0',
        version: 'v3.4.0',
        date: 'September 2026',
        badge: 'Previous Version',
        badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        title: 'EMS Responder Access & Unified Brand Synchronization',
        summary: 'Added direct EMS Responder screen access for Administrators & Controllers, alongside global logo, favicon, and company branding synchronization.',
        highlights: [
            {
                category: 'EMS & Medical',
                title: 'Admin & Controller EMS Responder Screen Access',
                description: 'Administrators and Controllers can now open and monitor the live EMS Responder interface directly from the primary navigation menu. Includes live GPS maps, turn-by-turn dispatch updates, patient triage indicators, and digital Patient Care Report (PCR) management.',
                isNew: true
            },
            {
                category: 'Branding & Admin',
                title: 'Global Logo & Favicon Synchronization',
                description: 'Custom logos and favicons uploaded in Company Settings now instantly update across the app header, browser tabs, mobile home shortcuts, and printable report headers without manual refreshes.',
                isNew: true
            },
            {
                category: 'Branding & Admin',
                title: 'Modular System Access Controls',
                description: 'Administrators can precisely enable or restrict specific operational modules (Controller, EMS, Tech Ops, Guarding, Gate Access, Attendance) per company profile.',
                isNew: true
            }
        ]
    },
    {
        id: 'rel-3.3.0',
        version: 'v3.3.0',
        date: 'August 2026',
        badge: 'Major Release',
        badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        title: 'Medical Emergency Services & Tech Ops Integration',
        summary: 'Introduced the medical dispatch center for emergency medical calls and field technical callout tracking.',
        highlights: [
            {
                category: 'EMS & Medical',
                title: 'Medical Emergency Dispatch Center',
                description: 'Integrated emergency call intake with OB number logging, caller detail capture, medical triage level categorization (P1 Critical to P4 Routine), and direct unit dispatching.'
            },
            {
                category: 'Tech Ops & Drivers',
                title: 'Technical Operations & Field Callouts',
                description: 'Comprehensive field diagnostics dashboard for technicians to log site visits, hardware repairs, alarm panel servicing, and maintenance work orders.'
            },
            {
                category: 'Reporting & Security',
                title: 'Custom BOLO Graphic Headers',
                description: 'Support for custom high-impact visual banners on community BOLO (Be On Look Out) cards to improve visibility for urgent crime alerts.'
            }
        ]
    },
    {
        id: 'rel-3.2.0',
        version: 'v3.2.0',
        date: 'July 2026',
        badge: 'Security Suite',
        badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        title: 'Guarding Patrol Checkpoints & Gate Access Control',
        summary: 'Expanded security operations with guard patrol scanning, visitor gate management, and digital attendance rosters.',
        highlights: [
            {
                category: 'Guarding & Patrols',
                title: 'QR Patrol Checkpoint Scanner',
                description: 'Guards on duty can scan physical QR codes at designated site checkpoints with automated GPS timestamping and supervisor alert notifications.'
            },
            {
                category: 'Guarding & Patrols',
                title: 'Visitor & Contractor Gate Access',
                description: 'Streamlined gate control interface for registering incoming visitors, vehicles, and contractors with digital access passes and exit logging.'
            },
            {
                category: 'Guarding & Patrols',
                title: 'Digital Guard Attendance Roster',
                description: 'Real-time shift clock-in and clock-out monitoring with supervisor verification and exportable monthly attendance logs.'
            }
        ]
    },
    {
        id: 'rel-3.1.0',
        version: 'v3.1.0',
        date: 'June 2026',
        badge: 'Dispatch Update',
        badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        title: 'Roadside Driver Operations & Global Live Map',
        summary: 'Added roadside assistance towing dispatches, live unified incident map, and corporate PSIRA record tracking.',
        highlights: [
            {
                category: 'Tech Ops & Drivers',
                title: 'Roadside Assistance Driver Operations',
                description: 'Dedicated dispatch screen for breakdown drivers, vehicle recovery operators, and roadside service units.'
            },
            {
                category: 'Reporting & Security',
                title: 'Unified Interactive Live Map',
                description: 'Interactive map clustering vehicle incidents, crime alerts, emergency calls, and active responder locations on a single real-time dashboard.'
            },
            {
                category: 'Branding & Admin',
                title: 'PSIRA Records & Corporate Profiles',
                description: 'Enhanced company profiles with mandatory PSIRA license tracking, owner contacts, and role-based staff permissions.'
            }
        ]
    },
    {
        id: 'rel-3.0.0',
        version: 'v3.0.0',
        date: 'May 2026',
        badge: 'Core Analytics',
        badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        title: 'Global Incident Search & Executive Analytics',
        summary: 'Introduced fast cross-module search capabilities, PDF summary generation, and interactive analytics dashboards.',
        highlights: [
            {
                category: 'Reporting & Security',
                title: 'Global Search Engine',
                description: 'Instant multi-field search allowing admins to search across OB numbers, vehicle license plates, suspect descriptions, and phone numbers in seconds.'
            },
            {
                category: 'Reporting & Security',
                title: 'Executive Analytics & Printable Summaries',
                description: 'High-level analytical charts for incident breakdown, response times, and exportable PDF summaries for client reporting.'
            }
        ]
    }
];

export const ChangeLogModal: React.FC<ChangeLogModalProps> = ({ isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    if (!isOpen) return null;

    const categories = ['All', 'EMS & Medical', 'Guarding & Patrols', 'Tech Ops & Drivers', 'Branding & Admin', 'Reporting & Security'];

    const filteredReleases = RELEASES.map(rel => {
        const matchesCategory = selectedCategory === 'All' || rel.highlights.some(h => h.category === selectedCategory);
        const matchesSearch = !searchQuery.trim() || 
            rel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rel.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rel.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rel.highlights.some(h => h.title.toLowerCase().includes(searchQuery.toLowerCase()) || h.description.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesCategory || !matchesSearch) return null;

        const highlights = selectedCategory === 'All' 
            ? rel.highlights 
            : rel.highlights.filter(h => h.category === selectedCategory);

        return { ...rel, highlights };
    }).filter(Boolean) as ReleaseItem[];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-6" onClick={onClose}>
            <div 
                className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-gray-900 dark:text-white"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Banner */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white relative flex-shrink-0">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3 mb-2">
                        <span className="p-2 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
                            <HistoryIcon className="w-6 h-6" />
                        </span>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">System Change Log & Feature Updates</h2>
                            <p className="text-xs sm:text-sm text-blue-200/80">Executive overview of feature enhancements and operational updates for administrators.</p>
                        </div>
                    </div>

                    {/* Filter & Search Toolbar */}
                    <div className="mt-4 flex flex-col sm:flex-row gap-3 pt-3 border-t border-white/10">
                        {/* Search Input */}
                        <div className="relative flex-grow">
                            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search features, releases, or modules..."
                                className="w-full pl-9 pr-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs sm:text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                            />
                        </div>

                        {/* Category Badges */}
                        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                                        selectedCategory === cat 
                                            ? 'bg-blue-500 text-white shadow-sm' 
                                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Timeline Area */}
                <div className="flex-grow overflow-y-auto p-5 sm:p-6 space-y-8 custom-scrollbar">
                    {filteredReleases.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <Filter className="w-10 h-10 mx-auto mb-3 opacity-40" />
                            <p className="text-base font-medium">No matching release notes found.</p>
                            <p className="text-xs mt-1">Try clearing your search query or switching categories.</p>
                            <button 
                                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                                className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                            >
                                Reset Filters
                            </button>
                        </div>
                    ) : (
                        filteredReleases.map((release, index) => (
                            <div key={release.id} className="relative pl-6 sm:pl-8 border-l-2 border-blue-500/30 dark:border-blue-500/20 last:border-l-transparent">
                                {/* Timeline Node */}
                                <div className={`absolute -left-[9px] top-0.5 w-4 h-4 rounded-full border-2 ${
                                    index === 0 
                                        ? 'bg-blue-600 border-white dark:border-gray-900 ring-4 ring-blue-500/20 animate-pulse' 
                                        : 'bg-gray-300 dark:bg-gray-700 border-white dark:border-gray-900'
                                }`} />

                                {/* Release Meta Bar */}
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className="text-lg font-black tracking-tight text-blue-600 dark:text-blue-400">
                                        {release.version}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {release.date}
                                    </span>
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${release.badgeColor}`}>
                                        {release.badge}
                                    </span>
                                </div>

                                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1">
                                    {release.title}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                                    {release.summary}
                                </p>

                                {/* Feature Highlight Cards */}
                                <div className="grid grid-cols-1 gap-3">
                                    {release.highlights.map((item, idx) => (
                                        <div 
                                            key={idx} 
                                            className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 transition-all hover:border-blue-500/40"
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                                        {item.category}
                                                    </span>
                                                    {item.isNew && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                            <Sparkles className="w-3 h-3" /> New
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                                {item.title}
                                            </h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-normal pl-5">
                                                {item.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                    <span>Rapid911 Executive Change Log • Version 3.4.0</span>
                    <button 
                        onClick={onClose}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors text-xs"
                    >
                        Close Release Notes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChangeLogModal;
