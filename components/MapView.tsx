
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip, GeoJSON } from 'react-leaflet';
import L, { LatLngBoundsExpression } from 'leaflet';
import { Report, Responder, VehicleReport, ReportStatus, Severity, ResponderStatus, ChatMessage } from '../types';
import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircleIcon, ShareIcon } from './icons';

interface MapViewProps {
  reports: Report[];
  responders: Responder[];
  selectedReportId: string | null;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const createRedPinIcon = () => {
    const iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 40px; height: 40px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">
        <path fill="#dc2626" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
        <circle cx="12" cy="9.5" r="2.5" fill="#ffffff"></circle>
    </svg>`;
    return new L.DivIcon({
        html: iconHtml,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
    });
};

const createResponderIcon = (status: ResponderStatus) => {
    let colorClass = 'text-gray-500'; // Off-duty (fallback)
    let pulseColorClass = '';

    switch (status) {
        case ResponderStatus.AVAILABLE: colorClass = 'text-green-500'; break;
        case ResponderStatus.EN_ROUTE: colorClass = 'text-blue-500'; pulseColorClass = 'bg-blue-400'; break;
        case ResponderStatus.ON_SCENE: colorClass = 'text-yellow-500'; break;
    }

    const pulseHtml = pulseColorClass ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColorClass} opacity-75"></span>` : '';

    const iconHtml = `
        <div class="relative flex items-center justify-center w-8 h-8">
            ${pulseHtml}
            <svg class="relative w-8 h-8 ${colorClass}" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <svg class="absolute w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        </div>
    `;

    return new L.DivIcon({
        html: iconHtml,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    });
};


const MapFocusController: React.FC<{ selectedReport: Report | undefined }> = ({ selectedReport }) => {
    const map = useMap();
    useEffect(() => {
        if (selectedReport) {
            if (selectedReport.location_boundingbox) {
                const bounds: LatLngBoundsExpression = [
                    [selectedReport.location_boundingbox[0], selectedReport.location_boundingbox[2]],
                    [selectedReport.location_boundingbox[1], selectedReport.location_boundingbox[3]]
                ];
                map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });
            } else if (selectedReport.location_coords) {
                map.flyTo([selectedReport.location_coords.lat, selectedReport.location_coords.lng], 15, { animate: true, duration: 1.0 });
            }
        }
    }, [selectedReport, map]);
    return null;
};

const ChatBox: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    return (
        <div className="h-28 overflow-y-auto p-2 space-y-2 bg-gray-100 dark:bg-gray-900/50 rounded-md border border-gray-200 dark:border-gray-700/50">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex text-white ${msg.sender === 'Controller' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-3 py-1 rounded-lg max-w-[80%] text-sm shadow-md ${msg.sender === 'Controller' ? 'bg-blue-600' : 'bg-gray-500 dark:bg-gray-700'}`}>{msg.text}</div>
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

    const tileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    const areaStyle = {
        fillColor: '#60A5FA',
        fillOpacity: 0.2,
        color: '#3B82F6',
        weight: 2,
    };

    return (
        <div className="h-full w-full rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700/50 shadow-lg dark:shadow-none">
            <MapContainer center={[-26.2041, 28.0473]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%', backgroundColor: '#f0f0f0' }}>
                <TileLayer 
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' 
                    url={tileUrl} />
                <MapFocusController selectedReport={selectedReport} />

                {responders.map(responder => (
                    responder.location_coords && (
                        <Marker
                            key={`responder-${responder.id}`}
                            position={[responder.location_coords.lat, responder.location_coords.lng]}
                            icon={createResponderIcon(responder.status)}
                            zIndexOffset={100}
                        >
                            <Tooltip direction="top" offset={[0, -10]}>
                                <div className="font-bold">{responder.full_name}</div>
                                <div className="capitalize">{responder.status.replace('_', ' ')}</div>
                            </Tooltip>
                        </Marker>
                    )
                ))}

                {selectedReport && (
                    <React.Fragment>
                        {selectedReport.location_boundary && (
                            <GeoJSON data={selectedReport.location_boundary} style={areaStyle} />
                        )}
                        {selectedReport.location_coords && (
                             <Marker position={[selectedReport.location_coords.lat, selectedReport.location_coords.lng]} icon={createRedPinIcon()}>
                                <Popup>
                                    <div className="w-64">
                                        <h3 className="font-bold text-lg mb-1">{isVehicleReport(selectedReport) ? selectedReport.license_plate : selectedReport.title}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mb-2">{selectedReport.ob_number}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{selectedReport.description}</p>
                                        <hr className="border-gray-200 dark:border-gray-600 my-2" />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Status</span><StatusBadge status={selectedReport.status} /></div>
                                            <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Severity</span><span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full ${selectedReport.severity === 'critical' ? 'bg-red-500/20 text-red-400' : selectedReport.severity === 'high' ? 'bg-orange-500/20 text-orange-400' : selectedReport.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{selectedReport.severity}</span></div>
                                        </div>
                                        
                                        {[ReportStatus.ACTIVE, ReportStatus.IN_PROGRESS].includes(selectedReport.status) && (
                                            <>
                                                <hr className="border-gray-200 dark:border-gray-600 my-2" />
                                                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Live Chat</h4>
                                                <ChatBox messages={chatMessages[selectedReport.id] || []} />
                                                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(selectedReport.id); }} className="mt-2 flex space-x-2">
                                                    <input type="text" placeholder="Send a message..." value={currentChatInput[selectedReport.id] || ''} onChange={(e) => setCurrentChatInput(prev => ({ ...prev, [selectedReport.id]: e.target.value }))} className="flex-grow bg-gray-100 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-md py-1 px-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all" />
                                                    <button type="submit" className="px-3 bg-blue-600 text-white font-semibold rounded-md text-sm hover:bg-blue-500 transition-colors">Send</button>
                                                </form>
                                            </>
                                        )}

                                        <hr className="border-gray-200 dark:border-gray-600 my-2" />
                                        <div className="flex justify-between items-center">
                                            <p className="text-xs text-gray-400 dark:text-gray-500">{formatDistanceToNow(new Date(selectedReport.reported_at), { addSuffix: true })}</p>
                                            <button onClick={() => handleShareReport(selectedReport.id)} className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors disabled:opacity-50" disabled={copiedReportId === selectedReport.id}>
                                                {copiedReportId === selectedReport.id ? <><CheckCircleIcon className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied!</span></> : <><ShareIcon className="w-4 h-4" /><span>Share</span></>}
                                            </button>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                    </React.Fragment>
                )}
            </MapContainer>
        </div>
    );
};

export default MapView;
