import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from '../components/ThemeToggle';
import { 
    BookOpenIcon, 
    ShieldIcon, 
    AlertTriangleIcon, 
    UsersIcon, 
    SettingsIcon, 
    ActivityIcon, 
    MapPinIcon, 
    SmartphoneIcon, 
    TvIcon, 
    WrenchIcon, 
    CheckCircle2Icon,
    DownloadIcon,
    EyeIcon,
    ArrowRightIcon,
    TerminalIcon,
    PhoneCallIcon,
    UploadCloudIcon,
    BellIcon,
    ShieldAlertIcon,
    MapIcon
} from 'lucide-react';

interface AboutPageProps {
    onBackToLogin: () => void;
}

type TabId = 'intro' | 'community' | 'guarding' | 'control' | 'techops' | 'admin';

const AboutPage: React.FC<AboutPageProps> = ({ onBackToLogin }) => {
    const { mainLogoUrl, defaultLogoUrl } = useSettings();
    const [activeTab, setActiveTab] = useState<TabId>('intro');
    const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

    // Dynamic banner image URL generated in the assets directory
    const heroBannerUrl = "/src/assets/images/safety_hero_banner_1782813489559.jpg";

    const tabs = [
        { id: 'intro', label: 'Overview & Intro', icon: BookOpenIcon, color: 'text-blue-500' },
        { id: 'community', label: 'Community & BOLO Cards', icon: UsersIcon, color: 'text-orange-500' },
        { id: 'guarding', label: 'Guarding & Patrols', icon: ShieldIcon, color: 'text-green-500' },
        { id: 'control', label: 'Control Room Ops', icon: TvIcon, color: 'text-red-500' },
        { id: 'techops', label: 'Tech Ops & Diagnostics', icon: WrenchIcon, color: 'text-indigo-500' },
        { id: 'admin', label: 'Admin & Settings', icon: SettingsIcon, color: 'text-purple-500' },
    ];

    const renderHeader = () => (
        <header className="fixed top-0 w-full z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img 
                        src={mainLogoUrl} 
                        alt="Vigilix Logo" 
                        className="h-10 w-auto" 
                        onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} 
                    />
                    <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                        Help & User Manual
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <button 
                        onClick={onBackToLogin}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        </header>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 font-sans transition-colors">
            {renderHeader()}

            {/* Main Content Area */}
            <main className="container mx-auto px-4 pt-24 pb-16">
                <div className="max-w-7xl mx-auto">
                    
                    {/* Cover Hero Banner Card */}
                    <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-10 shadow-lg border border-gray-200 dark:border-gray-800">
                        <img 
                            src={heroBannerUrl} 
                            alt="Vigilix Security Monitoring System Banner" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                                // Fallback image if there's any file access delay in the environment
                                e.currentTarget.src = "https://picsum.photos/seed/commandcenter/1200/400?blur=1";
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/70 to-transparent flex flex-col justify-end p-6 md:p-8">
                            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2 uppercase">
                                Vigilix Interactive Manual
                            </h1>
                            <p className="text-gray-300 text-sm md:text-lg max-w-2xl font-medium">
                                Your comprehensive guide to executing high-fidelity operations on the Vigilix security monitoring, guarding patrols, and dispatch management system.
                            </p>
                        </div>
                    </div>

                    {/* Left Navigation and Right Content Workspace */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        
                        {/* Sidebar Tab Selector */}
                        <div className="lg:col-span-1 space-y-2">
                            <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <h3 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">System Modules</h3>
                                <div className="space-y-1">
                                    {tabs.map((tab) => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveTab(tab.id as TabId);
                                                    setActiveHotspot(null);
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-all ${
                                                    isActive 
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20 shadow-sm' 
                                                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                }`}
                                            >
                                                <Icon className={`w-5 h-5 ${tab.color}`} />
                                                <span>{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Rapid Help Box */}
                            <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl shadow-md border border-emerald-500/20">
                                <PhoneCallIcon className="w-8 h-8 mb-3 opacity-90" />
                                <h4 className="font-bold mb-1">Need Urgent Support?</h4>
                                <p className="text-xs text-emerald-100 mb-4 leading-relaxed">
                                    For command-center system disruptions or urgent deployment inquiries, please call the active hotline.
                                </p>
                                <a 
                                    href="tel:+27846910111" 
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-emerald-700 font-bold text-xs rounded-md shadow-sm hover:bg-emerald-50 transition-colors"
                                >
                                    Call +27 84 69 10111
                                </a>
                            </div>
                        </div>

                        {/* Right Content Tab Details */}
                        <div className="lg:col-span-3 space-y-8">
                            
                            {/* Tab 1: Introduction & Overview */}
                            {activeTab === 'intro' && (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 md:p-8 shadow-sm">
                                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3 text-emerald-600 dark:text-emerald-400">
                                            <BookOpenIcon className="w-7 h-7" />
                                            Platform Introduction
                                        </h2>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 text-lg">
                                            The <strong>Vigilix Security Monitoring System</strong> is a modern, unified hub designed specifically for professional guarding, community safety, and emergency response teams. It seamlessly connects community members reporting local incidents, active guard forces patrolling commercial sites, and central controllers dispatching armed responders in real-time.
                                        </p>

                                        <h3 className="text-lg font-bold mb-3">Key System Roles & Ecosystem</h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="p-2 bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-lg font-bold text-sm">A</span>
                                                    <h4 className="font-bold">Community Users</h4>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                                    Report local emergency events, view global active alerts, check community maps, and share high-impact, formatted <strong>BOLO (Be On the Look Out) Cards</strong>.
                                                </p>
                                            </div>
                                            
                                            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="p-2 bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-lg font-bold text-sm">B</span>
                                                    <h4 className="font-bold">Guards & Patrols</h4>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                                    Execute scheduled site patrols, scan QR/NFC checkpoint tags, report on-duty GPS locations, and log visitor vehicle details at access control gates.
                                                </p>
                                            </div>

                                            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="p-2 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg font-bold text-sm">C</span>
                                                    <h4 className="font-bold">Control Room Controllers</h4>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                                    Monitor live incident panic streams, dispatch security vehicles based on optimized GPS distance, track patrol checklists, and manage active incident alerts.
                                                </p>
                                            </div>

                                            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="p-2 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold text-sm">D</span>
                                                    <h4 className="font-bold">Technicians & Admins</h4>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                                    Provision checkpoint sites, update corporate branding logos, customize contact lines, diagnose terminal signals, and audit comprehensive system logs.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* System Workflow diagram */}
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 md:p-8 shadow-sm">
                                        <h3 className="text-xl font-bold mb-4">Unified System Lifecycle Flow</h3>
                                        <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
                                            <div className="text-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full md:w-1/4">
                                                <span className="text-2xl">🚨</span>
                                                <h5 className="font-bold text-sm mt-1">1. Threat Detection</h5>
                                                <p className="text-[10px] text-gray-500">Community alert or missed guard checkpoint triggers state.</p>
                                            </div>
                                            <ArrowRightIcon className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0" />
                                            <div className="text-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full md:w-1/4">
                                                <span className="text-2xl">📊</span>
                                                <h5 className="font-bold text-sm mt-1">2. Control Dispatch</h5>
                                                <p className="text-[10px] text-gray-500">Controller analyses and dispatches the closest active responder.</p>
                                            </div>
                                            <ArrowRightIcon className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0" />
                                            <div className="text-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full md:w-1/4">
                                                <span className="text-2xl">🚗</span>
                                                <h5 className="font-bold text-sm mt-1">3. Active Response</h5>
                                                <p className="text-[10px] text-gray-500">Responder heads to site; dynamic BOLO card is compiled.</p>
                                            </div>
                                            <ArrowRightIcon className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0" />
                                            <div className="text-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full md:w-1/4">
                                                <span className="text-2xl">✅</span>
                                                <h5 className="font-bold text-sm mt-1">4. Resolution</h5>
                                                <p className="text-[10px] text-gray-500">Incident archived and synced for security reporting.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab 2: Community & BOLO Creator */}
                            {activeTab === 'community' && (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 md:p-8 shadow-sm">
                                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3 text-orange-500">
                                            <UsersIcon className="w-7 h-7" />
                                            Community Portal & BOLO Card Guide
                                        </h2>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                                            The Community Portal allows residents and clients to easily log safety concerns. When an incident involves a vehicle, the system triggers the custom **BOLO (Be On the Look Out) Generator** to compile a high-impact branding poster for immediate emergency sharing.
                                        </p>

                                        {/* Dynamic Screenshot Hotspot Container */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold tracking-wider uppercase text-gray-400">Interactive Screenshot: Simulated BOLO Card Layout</span>
                                                <span className="text-[10px] px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold rounded">Click hotspots to learn</span>
                                            </div>
                                            
                                            {/* HTML Simulated Screenshot Frame */}
                                            <div className="relative border border-gray-300 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-950 p-4 md:p-8 select-none">
                                                
                                                {/* Hotspot Indicators */}
                                                <button 
                                                    onClick={() => setActiveHotspot('bolo_logo')}
                                                    className="absolute top-10 right-10 w-6 h-6 rounded-full bg-orange-500 border-2 border-white animate-ping flex items-center justify-center text-[10px] font-bold text-white z-10"
                                                >
                                                    1
                                                </button>
                                                <button 
                                                    onClick={() => setActiveHotspot('bolo_logo')}
                                                    className="absolute top-10 right-10 w-6 h-6 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white z-10"
                                                >
                                                    1
                                                </button>

                                                <button 
                                                    onClick={() => setActiveHotspot('bolo_image')}
                                                    className="absolute top-1/2 left-1/3 w-6 h-6 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white z-10"
                                                >
                                                    2
                                                </button>

                                                <button 
                                                    onClick={() => setActiveHotspot('bolo_contact')}
                                                    className="absolute bottom-12 right-1/4 w-6 h-6 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white z-10"
                                                >
                                                    3
                                                </button>

                                                {/* Visual Mock BOLO Card */}
                                                <div className="max-w-3xl mx-auto bg-neutral-900 border-4 border-[#F25A22] rounded-xl overflow-hidden shadow-2xl">
                                                    
                                                    {/* Card Header */}
                                                    <div className="bg-[#F25A22] text-black px-6 py-4 flex justify-between items-center">
                                                        <div>
                                                            <h4 className="text-xl md:text-3xl font-black tracking-tighter uppercase leading-none">BOLO</h4>
                                                            <p className="text-[10px] font-bold tracking-widest uppercase">Be On The Look Out</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs font-black tracking-widest bg-black text-white px-2.5 py-1 rounded">SUSPICIOUS VEHICLE</span>
                                                        </div>
                                                    </div>

                                                    {/* Upper Section */}
                                                    <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-start gap-4">
                                                        <div className="space-y-1 text-white">
                                                            <h5 className="text-sm text-gray-400 font-bold uppercase tracking-wider">Report Info</h5>
                                                            <p className="text-sm font-semibold">Incident Ref: <span className="font-mono text-orange-400 font-bold">#INC-48192</span></p>
                                                            <p className="text-sm">Location: <span className="font-bold">Johannesburg CBD</span></p>
                                                            <p className="text-sm">Logged: <span className="font-mono text-gray-300">2026-06-30 09:50</span></p>
                                                        </div>

                                                        {/* Brand Logo inside card */}
                                                        <div className="w-40 h-16 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center p-2">
                                                            <div className="text-center">
                                                                <span className="text-[10px] font-black text-white block">EXCELLERATE</span>
                                                                <span className="text-[8px] tracking-widest text-[#F25A22] uppercase block">SERVICES</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Captured Vehicle Image containing fit cropping */}
                                                    <div className="h-44 bg-neutral-950 flex items-center justify-center relative overflow-hidden border-y border-neutral-800">
                                                        {/* Simulated fitted image of suspect vehicle */}
                                                        <div className="absolute inset-0 opacity-20 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=600')" }}></div>
                                                        <img 
                                                            src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=600" 
                                                            alt="Simulated Suspect Vehicle" 
                                                            className="h-full w-auto object-contain z-10 relative" 
                                                            referrerPolicy="no-referrer"
                                                        />
                                                        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 border border-neutral-700 text-[10px] text-gray-400 rounded font-mono">
                                                            Aspect Fit & Background Fill Enabled
                                                        </span>
                                                    </div>

                                                    {/* Specifications Table */}
                                                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-neutral-800 border-b border-neutral-800 bg-neutral-900">
                                                        <div className="p-3 text-center">
                                                            <span className="text-[9px] text-gray-400 block font-bold uppercase">Plate Number</span>
                                                            <span className="text-sm font-black text-orange-400 font-mono">ND 182-948</span>
                                                        </div>
                                                        <div className="p-3 text-center">
                                                            <span className="text-[9px] text-gray-400 block font-bold uppercase">Vehicle Brand</span>
                                                            <span className="text-sm font-bold text-white">Toyota Hilux</span>
                                                        </div>
                                                        <div className="p-3 text-center">
                                                            <span className="text-[9px] text-gray-400 block font-bold uppercase">Color</span>
                                                            <span className="text-sm font-bold text-white">Metallic Silver</span>
                                                        </div>
                                                        <div className="p-3 text-center">
                                                            <span className="text-[9px] text-gray-400 block font-bold uppercase">Incident Type</span>
                                                            <span className="text-sm font-bold text-white">Suspicious Loitering</span>
                                                        </div>
                                                    </div>

                                                    {/* Footer Info (Excellerate Services details + custom contacts) */}
                                                    <div className="bg-black text-white px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                                                        <div className="text-center md:text-left">
                                                            <h6 className="font-extrabold tracking-wide text-xs">IF SPOTTED PLEASE CONTACT</h6>
                                                            <p className="text-[10px] text-gray-400 font-medium">EXCELLERATE SECURITY OPERATIONS CENTRE</p>
                                                        </div>
                                                        <div className="text-center md:text-right">
                                                            <h6 className="text-[#F25A22] text-xl font-black font-mono">+278469-10111</h6>
                                                            <p className="text-[8px] text-gray-500 font-mono">NATIONAL NCC LINES</p>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>

                                            {/* Hotspot details drawer */}
                                            {activeHotspot === 'bolo_logo' && (
                                                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg animate-fade-in">
                                                    <h5 className="font-bold text-orange-700 dark:text-orange-400 text-sm mb-1">1. Custom Branding Logos</h5>
                                                    <p className="text-xs text-orange-950 dark:text-orange-300 leading-relaxed">
                                                        Instead of showing default system icons, BOLO headers automatically render the official company logo of the organization responding (e.g. Excellerate Services). This is highly customized inside the administrator workspace profile.
                                                    </p>
                                                </div>
                                            )}

                                            {activeHotspot === 'bolo_image' && (
                                                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg animate-fade-in">
                                                    <h5 className="font-bold text-orange-700 dark:text-orange-400 text-sm mb-1">2. Smart Image Fit Layout</h5>
                                                    <p className="text-xs text-orange-950 dark:text-orange-300 leading-relaxed">
                                                        Images uploaded during emergency events come in varying aspect ratios. Our canvas drawer employs dual-layer rendering: a subtle 15% opacity blur-fill behind the main asset, combined with a precise scale-fit main container. This guarantees critical details are never cropped or truncated.
                                                    </p>
                                                </div>
                                            )}

                                            {activeHotspot === 'bolo_contact' && (
                                                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg animate-fade-in">
                                                    <h5 className="font-bold text-orange-700 dark:text-orange-400 text-sm mb-1">3. Active Company Emergency Contacts</h5>
                                                    <p className="text-xs text-orange-950 dark:text-orange-300 leading-relaxed">
                                                        The BOLO card replaces default generic contact numbers with your registered Excellerate operations contact cell (<span className="font-bold font-mono">+278469-10111</span>). When shared, community readers can tap directly to alert command control.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <h3 className="text-lg font-bold mb-3">How to Log a Report and Create a BOLO</h3>
                                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300 pl-2">
                                            <li>Navigate to the **Report Incident** or **User Dashboard** form.</li>
                                            <li>Select an emergency category (e.g., Vehicle Theft, Hijacking, Suspicious Vehicle).</li>
                                            <li>Fill in the vehicle specifications: **License Plate**, **Make/Model**, and **Color**.</li>
                                            <li>Upload an image of the scene or vehicle (PNG/JPG).</li>
                                            <li>Click **Save Report**. Once successfully saved, open the report details, and click the **"Share BOLO Card"** or **"Download BOLO Image"** buttons. The platform compiles the card on-the-fly for dispatching!</li>
                                        </ol>
                                    </div>
                                </div>
                            )}

                            {/* Tab 3: Guarding & Patrol Scanning */}
                            {activeTab === 'guarding' && (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 md:p-8 shadow-sm">
                                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3 text-green-500">
                                            <ShieldIcon className="w-7 h-7" />
                                            Guarding, QR Patrols & Access Gates
                                        </h2>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                                            Designed specifically for on-site security guards, this module tracks patrol route performance and catalogs incoming vehicle registration details at entry and exit gates.
                                        </p>

                                        {/* HTML Simulated Mobile Phone Screen */}
                                        <div className="mb-6 max-w-md mx-auto">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold tracking-wider uppercase text-gray-400">Guards Mobile Screen Interface Mockup</span>
                                                <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold rounded">Live Monitor</span>
                                            </div>

                                            {/* Phone Container Shell */}
                                            <div className="border-[8px] border-neutral-800 rounded-[32px] overflow-hidden bg-neutral-950 shadow-2xl relative">
                                                
                                                {/* Top Camera Notch */}
                                                <div className="absolute top-0 inset-x-0 h-4 bg-neutral-800 flex justify-center items-center">
                                                    <div className="w-20 h-2.5 bg-black rounded-full"></div>
                                                </div>

                                                {/* Phone Screen body */}
                                                <div className="p-4 pt-8 text-white min-h-[480px] flex flex-col justify-between">
                                                    
                                                    {/* Top Header */}
                                                    <div className="flex justify-between items-center border-b border-neutral-800 pb-2 mb-3">
                                                        <div>
                                                            <span className="text-[9px] text-gray-400 block font-bold">EXCELLERATE SERVICES</span>
                                                            <h5 className="text-xs font-black">ACTIVE GUARD PATROL</h5>
                                                        </div>
                                                        <span className="px-1.5 py-0.5 bg-green-900/40 text-green-400 font-mono text-[9px] font-bold rounded-md animate-pulse">
                                                            ● ONLINE
                                                        </span>
                                                    </div>

                                                    {/* Current Patrol Info */}
                                                    <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
                                                        <p className="text-[10px] text-gray-400">CURRENT ASSIGNED SITE</p>
                                                        <h6 className="text-xs font-black">Gauteng Warehouse Alpha</h6>
                                                        <div className="flex justify-between text-[10px] text-gray-400 pt-1">
                                                            <span>Shift: <span className="text-white font-medium">06:00 - 18:00</span></span>
                                                            <span>Route: <span className="text-white font-medium">Outer Perimeter</span></span>
                                                        </div>
                                                    </div>

                                                    {/* Big QR Scanner Button Mock */}
                                                    <div className="my-6 text-center space-y-3">
                                                        <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-tr from-green-600 to-emerald-500 flex items-center justify-center p-1 shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-transform cursor-pointer">
                                                            <div className="w-full h-full rounded-full bg-neutral-950 flex flex-col items-center justify-center border border-green-500/30">
                                                                <SmartphoneIcon className="w-8 h-8 text-green-400 animate-bounce" />
                                                                <span className="text-[9px] font-extrabold text-green-400 tracking-wider mt-1 uppercase">TAP TO SCAN</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400">Aim camera at checkpoint QR tag or tap near NFC beacon</p>
                                                    </div>

                                                    {/* Checkpoint Progress List */}
                                                    <div className="space-y-2">
                                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Today's Checkpoints (3/4)</span>
                                                        
                                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                                            <div className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg text-xs border border-neutral-800">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2Icon className="w-4 h-4 text-green-400" />
                                                                    <span>#1 - Front Gate Entrance</span>
                                                                </div>
                                                                <span className="font-mono text-[9px] text-gray-400">08:12</span>
                                                            </div>

                                                            <div className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg text-xs border border-neutral-800">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2Icon className="w-4 h-4 text-green-400" />
                                                                    <span>#2 - Loading Dock Rear</span>
                                                                </div>
                                                                <span className="font-mono text-[9px] text-gray-400">08:45</span>
                                                            </div>

                                                            <div className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg text-xs border border-neutral-800">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2Icon className="w-4 h-4 text-green-400" />
                                                                    <span>#3 - Main Server Room</span>
                                                                </div>
                                                                <span className="font-mono text-[9px] text-gray-400">09:15</span>
                                                            </div>

                                                            <div className="flex items-center justify-between p-2 bg-neutral-900/50 rounded-lg text-xs border border-dashed border-neutral-800">
                                                                <div className="flex items-center gap-2 text-gray-400">
                                                                    <div className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[8px]">4</div>
                                                                    <span>#4 - Visitor Parking East</span>
                                                                </div>
                                                                <span className="font-mono text-[9px] text-yellow-500 animate-pulse">PENDING</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>

                                        <h3 className="text-lg font-bold mb-3">Workflow Directions</h3>
                                        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                                            <div>
                                                <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 text-xs uppercase mb-1">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Attendance Logging
                                                </h4>
                                                <p className="text-xs pl-4">Guards must clock on-duty in the **Attendance** view. This locks in their active GPS geofenced coordinates to prevent remote clock-ins.</p>
                                            </div>
                                            
                                            <div>
                                                <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 text-xs uppercase mb-1">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Active QR Guard Patrols
                                                </h4>
                                                <p className="text-xs pl-4">Move from checkpoint to checkpoint as scheduled by your commander. Using the mobile browser view, press **Scan Checkpoint** and scan the physical barcode or QR printed sticker. The log instantly syncs back to the Control Room.</p>
                                            </div>

                                            <div>
                                                <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 text-xs uppercase mb-1">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Gate Access Records
                                                    <span className="ml-2 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[9px]">OCR Enabled</span>
                                                </h4>
                                                <p className="text-xs pl-4">When a visitor vehicle arrives at a gate, open **Gate Access Page**, enter the license plate or take a photo of the vehicle. The app's **Tesseract OCR engine** will automatically scan the plate and flag if that car is listed on any active BOLO alerts!</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab 4: Control Room Operations */}
                            {activeTab === 'control' && (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 md:p-8 shadow-sm">
                                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3 text-red-500">
                                            <TvIcon className="w-7 h-7" />
                                            Central Control Room & Dispatch
                                        </h2>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                                            The central commander view. Controllers oversee all active incident reports, dispatch armed response, trace live guard positions, and handle panic escalations.
                                        </p>

                                        {/* HTML Simulated Control Center Split-View */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold tracking-wider uppercase text-gray-400">Control Room Panel Mockup (Desktop layout)</span>
                                                <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold rounded">Live Monitor</span>
                                            </div>

                                            <div className="border border-neutral-800 rounded-xl bg-neutral-950 p-4 font-mono text-white text-xs space-y-4">
                                                
                                                {/* Top Status and Global Map Area */}
                                                <div className="grid md:grid-cols-3 gap-3">
                                                    
                                                    {/* Feed Panel */}
                                                    <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 space-y-2 md:col-span-1">
                                                        <h6 className="font-extrabold text-red-500 border-b border-neutral-800 pb-1 flex items-center gap-1.5">
                                                            <AlertTriangleIcon className="w-4 h-4 animate-pulse" />
                                                            UNRESOLVED INCIDENTS
                                                        </h6>
                                                        <div className="space-y-1.5">
                                                            <div className="p-2 bg-red-950/40 border border-red-500/30 rounded cursor-pointer hover:bg-red-950/60">
                                                                <div className="flex justify-between font-bold text-[10px]">
                                                                    <span>#INC-48192</span>
                                                                    <span className="text-red-400">LEVEL 5</span>
                                                                </div>
                                                                <p className="font-sans text-[10px] font-medium text-gray-300 mt-1">Toyota Hilux Theft (Plates ND 182-948)</p>
                                                            </div>
                                                            <div className="p-2 bg-neutral-800 border border-neutral-700 rounded cursor-pointer hover:bg-neutral-800/80">
                                                                <div className="flex justify-between font-bold text-[10px]">
                                                                    <span>#INC-48190</span>
                                                                    <span className="text-yellow-500">LEVEL 2</span>
                                                                </div>
                                                                <p className="font-sans text-[10px] font-medium text-gray-300 mt-1">Suspicious loitering near gate parking</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Central Map Simulation */}
                                                    <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 md:col-span-2 relative flex flex-col justify-between h-44 md:h-auto">
                                                        <div className="flex justify-between items-center text-[10px] text-gray-400">
                                                            <span>GEOGRAPHIC INCIDENT MATRIX</span>
                                                            <span className="text-blue-400">GPS STABILIZED</span>
                                                        </div>
                                                        
                                                        {/* Simulated Grid Maps with Pins */}
                                                        <div className="flex-grow flex items-center justify-center relative overflow-hidden border border-neutral-800 my-2 rounded bg-neutral-950">
                                                            <div className="absolute inset-0 bg-radial-gradient from-blue-900/10 to-transparent"></div>
                                                            {/* Custom Grid lines */}
                                                            <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-10">
                                                                {Array.from({ length: 24 }).map((_, i) => (
                                                                    <div key={i} className="border border-neutral-600"></div>
                                                                ))}
                                                            </div>
                                                            {/* Incident Pin */}
                                                            <div className="absolute top-1/3 left-1/2 flex flex-col items-center">
                                                                <MapPinIcon className="w-5 h-5 text-red-500 animate-bounce" />
                                                                <span className="px-1 bg-red-600 text-white font-sans font-bold text-[8px] rounded mt-0.5">#INC-48192</span>
                                                            </div>
                                                            {/* Responder Pin */}
                                                            <div className="absolute top-2/3 left-1/3 flex flex-col items-center">
                                                                <MapPinIcon className="w-5 h-5 text-blue-400" />
                                                                <span className="px-1 bg-blue-600 text-white font-sans font-bold text-[8px] rounded mt-0.5">UNIT ALPHA (1.2km)</span>
                                                            </div>
                                                        </div>

                                                        <div className="text-[9px] text-gray-500 flex justify-between">
                                                            <span>Lat: -26.2041, Lng: 28.0473</span>
                                                            <span>Zoom: 14x</span>
                                                        </div>
                                                    </div>

                                                </div>

                                                {/* Bottom Dispatch Controls */}
                                                <div className="p-3 bg-neutral-900 rounded-lg border border-[#F25A22]/20 flex flex-col sm:flex-row justify-between items-center gap-3">
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 block font-bold">AUTOMATED RESPONSE CALCULATOR</span>
                                                        <h5 className="text-xs font-black">CLOSEST RESPONDER: <span className="text-[#F25A22]">UNIT ALPHA (ARMED RESPONSE)</span></h5>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button className="px-3 py-1.5 bg-[#F25A22] text-black font-extrabold rounded-md shadow-md text-xs hover:bg-[#F25A22]/80 transition-colors">
                                                            DISPATCH CLOSEST UNIT
                                                        </button>
                                                        <button className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-gray-300 font-bold rounded-md text-xs hover:bg-neutral-700 transition-colors">
                                                            RE-ROUTE UNIT
                                                        </button>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>

                                        <h3 className="text-lg font-bold mb-3">Key Operations Procedures</h3>
                                        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                                            <div>
                                                <h4 className="font-extrabold text-gray-800 dark:text-gray-200 text-xs uppercase mb-1">
                                                    1. Monitoring Live Feed
                                                </h4>
                                                <p className="text-xs pl-4">Active calls stream in live. Level 5 flags represent critical crimes or guard panic triggers. These require instantaneous response.</p>
                                            </div>

                                            <div>
                                                <h4 className="font-extrabold text-gray-800 dark:text-gray-200 text-xs uppercase mb-1">
                                                    2. Dispatch Calculations
                                                </h4>
                                                <p className="text-xs pl-4">When choosing a responder, the platform queries your active units database and measures geographical proximity. Click **Dispatch** inside the dashboard; the dispatched units get a notification route via Supabase realtime sync.</p>
                                            </div>

                                            <div>
                                                <h4 className="font-extrabold text-gray-800 dark:text-gray-200 text-xs uppercase mb-1">
                                                    3. Guard Shift Monitoring
                                                </h4>
                                                <p className="text-xs pl-4">The **Guard Monitoring** tab displays all sites under Excellerate Services. If a guard fails to log a checkpoint scan within their scheduled recurrence interval, the dashboard flashes a warning alarm for manual dispatch check-ins.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab 5: Tech Ops & Diagnostics */}
                            {activeTab === 'techops' && (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 md:p-8 shadow-sm">
                                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3 text-indigo-500">
                                            <WrenchIcon className="w-7 h-7" />
                                            Technical Operations & Device Diagnostics
                                        </h2>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                                            For technicians maintaining local infrastructure. Access device heartbeat metrics, test server payloads, and verify reader diagnostics.
                                        </p>

                                        {/* HTML Simulated Terminal Console */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold tracking-wider uppercase text-gray-400">Technical Console Diagnostic Simulator</span>
                                                <span className="text-[10px] px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold rounded">Console Live</span>
                                            </div>

                                            <div className="border border-neutral-800 rounded-xl bg-neutral-950 p-4 font-mono text-xs text-green-400 space-y-3 shadow-2xl relative overflow-hidden">
                                                
                                                {/* Scan Lines Overlay */}
                                                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_100%),linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-10"></div>
                                                
                                                <div className="flex justify-between items-center text-[10px] text-gray-500 border-b border-neutral-800 pb-1.5">
                                                    <span className="flex items-center gap-1.5 font-bold text-indigo-400">
                                                        <TerminalIcon className="w-4 h-4" />
                                                        DIAGNOSTIC SIGNAL TERMINAL v2.14
                                                    </span>
                                                    <span>UPTIME: 184h 12m</span>
                                                </div>

                                                <div className="space-y-1">
                                                    <p className="text-gray-500">[2026-06-30 09:40:12] INITIALIZING SYSTEM DEVICE AUDIT...</p>
                                                    <p className="text-gray-500">[2026-06-30 09:40:13] CONNECTING SUPABASE REALTIME CHANNEL...</p>
                                                    <p className="text-indigo-400">[2026-06-30 09:40:14] STATUS: OK - Channel "db_changes" listening...</p>
                                                    <p className="text-gray-500">[2026-06-30 09:40:15] CHECKING GATE SCANNER API LIVENESS...</p>
                                                    <p className="text-green-400 font-bold">[2026-06-30 09:40:16] LIVENESS REPORT: HTTP 200 OK - OCR Ready</p>
                                                    <p className="text-gray-500">[2026-06-30 09:40:18] READING ACTIVE SITE CONTROLLER BEACONS...</p>
                                                    <p className="text-yellow-500 font-medium">[2026-06-30 09:40:19] WARN: Beacon #08 (Visitor Lot) low battery telemetry - 12%</p>
                                                </div>

                                                <div className="pt-2 border-t border-neutral-800 flex justify-between items-center text-[10px] text-gray-500">
                                                    <span>Memory Heap: 48.2MB / 128MB</span>
                                                    <span className="px-2 py-0.5 bg-green-950/40 border border-green-500/30 text-green-400 rounded-md font-bold text-[8px]">ACTIVE HEARTBEAT</span>
                                                </div>

                                            </div>
                                        </div>

                                        <h3 className="text-lg font-bold mb-3">Diagnostic Guidelines</h3>
                                        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                                            <div>
                                                <h4 className="font-extrabold text-gray-800 dark:text-gray-200 text-xs uppercase mb-1">
                                                    Checking System Connection Status
                                                </h4>
                                                <p className="text-xs pl-4">If guards report that checkpoint scans are failing, check your network health inside the **Tech Ops** portal. Verify that database triggers are responding correctly using the heartbeat logs.</p>
                                            </div>

                                            <div>
                                                <h4 className="font-extrabold text-gray-800 dark:text-gray-200 text-xs uppercase mb-1">
                                                    Site Calibration & Beacon Mapping
                                                </h4>
                                                <p className="text-xs pl-4">Ensure physical QR stickers placed at customer sites match their configured longitude and latitude inside the setup schema. A discrepancy of more than 50 meters will trigger a GPS alignment discrepancy alert.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab 6: Admin Controls & Settings */}
                            {activeTab === 'admin' && (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 md:p-8 shadow-sm">
                                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3 text-purple-500">
                                            <SettingsIcon className="w-7 h-7" />
                                            Admin Customizations & Profile Setup
                                        </h2>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                                            Administrators govern system parameters, customize corporate branding identities, configure support emergency helplines, and review user activity logs.
                                        </p>

                                        {/* HTML Simulated Admin Profile Settings Panel */}
                                        <div className="mb-6 max-w-2xl mx-auto">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold tracking-wider uppercase text-gray-400">Excellerate Company Administration Panel Mockup</span>
                                                <span className="text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold rounded">Config Active</span>
                                            </div>

                                            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 p-4 md:p-6 text-xs space-y-4 text-gray-700 dark:text-gray-300">
                                                <h5 className="font-extrabold border-b border-neutral-100 dark:border-neutral-800 pb-2 text-purple-600 flex items-center gap-1.5 uppercase">
                                                    <SettingsIcon className="w-4 h-4" />
                                                    Corporate Branding Configuration
                                                </h5>

                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Operational Company Name</label>
                                                        <input 
                                                            type="text" 
                                                            value="EXCELLERATE SERVICES" 
                                                            disabled 
                                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-xs" 
                                                        />
                                                    </div>
                                                    
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Registered Emergency Helpline</label>
                                                        <input 
                                                            type="text" 
                                                            value="+278469-10111" 
                                                            disabled 
                                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-xs font-mono font-bold text-[#F25A22]" 
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Emergency Dispatch Level Sub-text</label>
                                                    <input 
                                                        type="text" 
                                                        value="SECURITY OPERATIONS CENTRE" 
                                                        disabled 
                                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-xs" 
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">BOLO Card Header Custom Logo</label>
                                                    <div className="border border-dashed border-gray-300 dark:border-neutral-700 rounded-lg p-4 text-center bg-gray-50 dark:bg-neutral-800 flex flex-col items-center justify-center">
                                                        <UploadCloudIcon className="w-6 h-6 text-purple-500 mb-1" />
                                                        <p className="text-[10px] text-gray-400">excellerate_services_logo.png (320x180 px)</p>
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded font-bold mt-1.5 uppercase">
                                                            ACTIVE LOGO SYNCED
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <h3 className="text-lg font-bold mb-3">Administrative Management Guidelines</h3>
                                        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                                            <div>
                                                <h4 className="font-extrabold text-gray-800 dark:text-gray-200 text-xs uppercase mb-1">
                                                    Branding Integrations
                                                </h4>
                                                <p className="text-xs pl-4">Inside the **Profile** or **Settings** view, Administrators can modify their brand identity. Uploading your SVG/PNG logo instantly propagates to all dynamically rendered views including: the login header, active maps, and the BOLO cards shared externally.</p>
                                            </div>

                                            <div>
                                                <h4 className="font-extrabold text-gray-800 dark:text-gray-200 text-xs uppercase mb-1">
                                                    Full Security Auditing & Logs
                                                </h4>
                                                <p className="text-xs pl-4">For regulatory compliance, the platform records every operational action in the **Activity Logs** tab. Check-ins, QR scans, responder dispatches, and record downloads log the actor's ID, geographic coordinate stamps, and timestamp data.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                    </div>

                    {/* Quick Access FAQ Section */}
                    <div className="mt-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm">
                        <h3 className="text-2xl font-black mb-6 text-center border-b border-gray-100 dark:border-gray-800 pb-4 uppercase">
                            Frequently Asked Questions & Support
                        </h3>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-extrabold mb-2 text-blue-600 dark:text-blue-400">
                                    Q: Why isn't my gate access scanner reading the license plate?
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    Ensure that there is sufficient ambient light falling on the plate, and that the text is centered within the camera view frame. Clean camera lenses of debris. If scanning fails, you can type the plate characters manually for OCR verification.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-extrabold mb-2 text-blue-600 dark:text-blue-400">
                                    Q: How do we change the contact numbers displayed on BOLO cards?
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    BOLO contacts are dynamically populated based on the organization profile responding. Navigate to **Administration Workspace**, locate **Company Profile**, and modify the registered cellphone/hotline entry. Save to apply.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-extrabold mb-2 text-blue-600 dark:text-blue-400">
                                    Q: Are guards allowed to scan checkpoints if GPS is disabled?
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    No. The system strictly enforces geographic proof of patrol to guarantee guards are physically present at the beacon. Ensure location services are activated in your mobile browser.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-extrabold mb-2 text-blue-600 dark:text-blue-400">
                                    Q: What image formats are supported for vehicle uploads?
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    The card compiler supports standard `.png`, `.jpg`, and `.jpeg` files. The system automatically compresses large captures server-side to save mobile dispatch bandwidth.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default AboutPage;
