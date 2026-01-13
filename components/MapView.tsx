import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Report, Responder, VehicleReport, CrimeReport, ReportStatus, Severity, LocationCoords, ResponderStatus, ChatMessage } from '../types';
import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircleIcon, ShareIcon } from './icons';

interface MapViewProps {
  reports: Report[];
  responders: Responder[];
  selectedReportId: string | null;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const createVehicleIcon = (severity: Severity, status: ReportStatus, isSelected: boolean) => {
    let glowClass = '';
    let bgColorClass = '';

    if (status === ReportStatus.RECOVERED || status === ReportStatus.RESOLVED) {
        bgColorClass = 'bg-green-600';
        glowClass = 'glow-green';
    } else if (status === ReportStatus.REJECTED) {
        bgColorClass = 'bg-red-600';
        glowClass = 'glow-red';
    } else {
        const isHighSeverity = severity === Severity.CRITICAL || severity === Severity.HIGH;
        glowClass = isHighSeverity ? 'glow-red' : 'glow-blue';
        bgColorClass = isHighSeverity ? 'bg-red-600' : 'bg-blue-600';
    }

    const selectedRing = isSelected ? '<div class="absolute -top-1 -left-1 w-10 h-10 rounded-full border-2 border-blue-400 pulse-ring-animation"></div>' : '';
    
    const vehicleIconHtml = `<div class="relative w-8 h-8">
        ${selectedRing}
        <div class="absolute top-0 left-0 w-8 h-8 ${bgColorClass} border-2 border-white/80 rounded-full shadow-lg flex items-center justify-center ${glowClass}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16.5V14a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2.5"/><path d="M20 10h-2.5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2H4"/><path d="M19 17h.01"/><path d="M5 17h.01"/><path d="M2 10l3.5-3.5A2 2 0 0 1 7 6h10a2 2 0 0 1 1.5.5L22 10"/></svg>
        </div>
    </div>`;

    return new L.DivIcon({ html: vehicleIconHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
};

const createCrimeIcon = (status: ReportStatus, isSelected: boolean) => {
    let glowClass = 'glow-red';
    let bgColorClass = 'bg-red-600';

    if (status === ReportStatus.RESOLVED) {
        bgColorClass = 'bg-green-600';
        glowClass = 'glow-green';
    } else if (status === ReportStatus.REJECTED) {
        bgColorClass = 'bg-red-600';
        glowClass = 'glow-red';
    }
    
    const selectedRing = isSelected ? '<div class="absolute -top-1 -left-1 w-10 h-10 rounded-full border-2 border-blue-400 pulse-ring-animation"></div>' : '';

    const crimeIconHtml = `<div class="relative w-8 h-8">
        ${selectedRing}
        <div class="absolute top-0 left-0 w-8 h-8 ${bgColorClass} border-2 border-white/80 rounded-full shadow-lg flex items-center justify-center ${glowClass}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9.5 14.5 5-5"/><path d="m9.5 9.5 5 5"/></svg>
        </div>
    </div>`;

    return new L.DivIcon({ html: crimeIconHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
};

const createResponderIcon = (status: ResponderStatus) => {
    let statusDotColor: string;
    let pulseClass = '';
    let mainIconOpacity = 'opacity-100';

    switch (status) {
        case ResponderStatus.AVAILABLE: statusDotColor = 'bg-green-500'; pulseClass = 'animate-pulse'; break;
        case ResponderStatus.EN_ROUTE: case ResponderStatus.ON_SCENE: statusDotColor = 'bg-yellow-500'; break;
        case ResponderStatus.OFF_DUTY: default: statusDotColor = 'bg-gray-500'; mainIconOpacity = 'opacity-60'; break;
    }

    const responderIconHtml = `<div class="relative flex items-center justify-center ${mainIconOpacity}">
        <div class="w-7 h-7 bg-blue-600 rounded-full border-2 border-white/60 shadow-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <div class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${statusDotColor} ${pulseClass}"></div>
    </div>`;
    
    return new L.DivIcon({ html: responderIconHtml, className: '', iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
};

const MapFlyTo: React.FC<{ selectedReportLocation: LocationCoords | null }> = ({ selectedReportLocation }) => {
    const map = useMap();
    useEffect(() => {
        if (selectedReportLocation) {
            map.flyTo([selectedReportLocation.lat, selectedReportLocation.lng], 15, { animate: true, duration: 1.0 });
        }
    }, [selectedReportLocation, map]);
    return null;
};

const ChatBox: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    return (
        <div className="h-28 overflow-y-auto p-2 space-y-2 bg-gray-900/50 rounded-md border border-gray-700/50">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex text-white ${msg.sender === 'Controller' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-3 py-1 rounded-lg max-w-[80%] text-sm shadow-md ${msg.sender === 'Controller' ? 'bg-blue-600' : 'bg-gray-700'}`}>{msg.text}</div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
    );
};

const MapView: React.FC<MapViewProps> = ({ reports, responders, selectedReportId }) => {
    const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
    const [currentChatInput, setCurrentChatInput] = useState<Record<string, string>>({});
    const [copiedReportId, setCopiedReportId] = useState<string | null>(null);

    const handleShareReport = (reportId: string) => {
        navigator.clipboard.writeText(`https://rapid-ireport.app/report/${reportId}`).then(() => {
            setCopiedReportId(reportId);
            setTimeout(() => setCopiedReportId(null), 2000);
        });
    };

    const handleSendMessage = (reportId: string) => {
        const text = currentChatInput[reportId];
        if (!text || text.trim() === '') return;

        const newMessage: ChatMessage = { id: crypto.randomUUID(), reportId, sender: 'Controller', text: text.trim(), timestamp: new Date().toISOString() };
        setChatMessages(prev => ({ ...prev, [reportId]: [...(prev[reportId] || []), newMessage] }));
        setCurrentChatInput(prev => ({ ...prev, [reportId]: '' }));
    };

    const selectedReport = reports.find(r => r.id === selectedReportId);

    return (
        <div className="h-full w-full rounded-2xl overflow-hidden border-2 border-gray-700/50">
            <MapContainer center={[-1.286389, 36.817223]} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <MapFlyTo selectedReportLocation={selectedReport?.location_coords || null} />

                {reports.filter(r => r.location_coords).map(report => (
                    <Marker key={report.id} position={[report.location_coords!.lat, report.location_coords!.lng]} icon={isVehicleReport(report) ? createVehicleIcon(report.severity, report.status, report.id === selectedReportId) : createCrimeIcon(report.status, report.id === selectedReportId)}>
                        <Popup>
                            <div className="w-64 text-white">
                                <h3 className="font-bold text-lg mb-1">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                                <p className="text-sm text-gray-400 font-mono mb-2">{report.ob_number}</p>
                                <p className="text-sm text-gray-300 mb-3">{report.description}</p>
                                <hr className="border-gray-600 my-2" />
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-500 uppercase">Status</span><StatusBadge status={report.status} /></div>
                                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-500 uppercase">Severity</span><span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full ${report.severity === 'critical' ? 'bg-red-500/20 text-red-400' : report.severity === 'high' ? 'bg-orange-500/20 text-orange-400' : report.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{report.severity}</span></div>
                                </div>
                                
                                {[ReportStatus.ACTIVE, ReportStatus.IN_PROGRESS].includes(report.status) && (
                                    <>
                                        <hr className="border-gray-600 my-2" />
                                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Live Chat</h4>
                                        <ChatBox messages={chatMessages[report.id] || []} />
                                        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(report.id); }} className="mt-2 flex space-x-2">
                                            <input type="text" placeholder="Send a message..." value={currentChatInput[report.id] || ''} onChange={(e) => setCurrentChatInput(prev => ({ ...prev, [report.id]: e.target.value }))} className="flex-grow bg-gray-800/80 border border-gray-700 rounded-md py-1 px-2 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all" />
                                            <button type="submit" className="px-3 bg-blue-600 text-white font-semibold rounded-md text-sm hover:bg-blue-500 transition-colors">Send</button>
                                        </form>
                                    </>
                                )}

                                <hr className="border-gray-600 my-2" />
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}</p>
                                    <button onClick={() => handleShareReport(report.id)} className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50" disabled={copiedReportId === report.id}>
                                        {copiedReportId === report.id ? <><CheckCircleIcon className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied!</span></> : <><ShareIcon className="w-4 h-4" /><span>Share</span></>}
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
                
                {responders.map(responder => (
                    <Marker key={responder.id} position={[responder.location_coords.lat, responder.location_coords.lng]} icon={createResponderIcon(responder.status)} zIndexOffset={1000}>
                        <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                            <div className="text-center">
                                <div className="font-bold text-white">{responder.full_name}</div>
                                <div className={`capitalize text-xs mt-1 ${responder.status === 'off_duty' ? 'text-gray-400' : responder.status === 'available' ? 'text-green-400' : 'text-yellow-400'}`}>{responder.status.replace('_', ' ')}</div>
                            </div>
                        </Tooltip>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default MapView;
