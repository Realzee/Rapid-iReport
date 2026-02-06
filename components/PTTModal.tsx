import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Profile } from '../types';
import { XIcon, RadioTowerIcon } from './icons';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';

// Helper function to play a beep sound using Web Audio API
const playBeep = (audioContext: AudioContext | null, frequency = 1000, duration = 0.15, volume = 0.3) => {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Fade in and out to prevent clicking
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
};

const isOnline = (lastSeen?: string): boolean => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeenDate > fiveMinutesAgo;
};

// Helper function to convert Float32Array to Base64
const float32ToBase64 = (float32Array: Float32Array): string => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 32767;
    }
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
};

// Helper function to convert Base64 to a playable AudioBuffer
const base64ToAudioBuffer = async (base64: string, audioContext: AudioContext): Promise<AudioBuffer> => {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const frameCount = int16Array.length;
    const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = int16Array[i] / 32768.0;
    }
    return buffer;
};

interface PTTModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: Profile;
}

const PTTModal: React.FC<PTTModalProps> = ({ isOpen, onClose, profile }) => {
    const [companyUsers, setCompanyUsers] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransmitting, setIsTransmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [target, setTarget] = useState<'all' | string>('all');
    const { addToast } = useToast();
    const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const nextPlayTimeRef = useRef<number>(0);
    const speakerTimeoutRef = useRef<number | null>(null);
    const lastSpeakerIdRef = useRef<string | null>(null);
    const lastPacketTimeRef = useRef<number>(0);

    useEffect(() => {
        if (!isOpen || !profile.company_id) {
            return;
        }

        const fetchCompanyUsers = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('company_id', profile.company_id);

            if (error) {
                setError('Failed to fetch company users.');
            } else {
                setCompanyUsers(data);
            }
            setIsLoading(false);
        };

        fetchCompanyUsers();

        const pttChannel = supabase.channel(`ptt-${profile.company_id}`, {
            config: { broadcast: { ack: true } }
        });

        pttChannel.on('broadcast', { event: 'audio-chunk' }, async ({ payload }) => {
            if (payload.audio && payload.from !== profile.id) {
                const isForAll = payload.target === 'all';
                const isForMe = payload.target === profile.id;
                
                if (isForAll || isForMe) {
                    if (!outputAudioContextRef.current) {
                        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    }
                    const audioContext = outputAudioContextRef.current;
                    
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                    }

                    // --- New Transmission Detection Logic ---
                    const nowMs = Date.now();
                    const isNewSpeaker = lastSpeakerIdRef.current !== payload.from;
                    const isAfterPause = (nowMs - lastPacketTimeRef.current) > 700; // 700ms pause defines a new burst
                    const isNewTransmission = isNewSpeaker || isAfterPause;

                    // Update trackers for the next packet
                    lastSpeakerIdRef.current = payload.from;
                    lastPacketTimeRef.current = nowMs;

                    // UI Active Speaker Logic
                    setActiveSpeakerId(payload.from);
                    if (speakerTimeoutRef.current) clearTimeout(speakerTimeoutRef.current);
                    speakerTimeoutRef.current = window.setTimeout(() => {
                        setActiveSpeakerId(null);
                    }, 700); // Match pause threshold

                    // --- Playback Scheduling ---
                    const now = audioContext.currentTime;
                    const MAX_QUEUE_AHEAD_TIME = 0.5;

                    // If playback schedule is too far ahead, reset it to catch up.
                    if (nextPlayTimeRef.current > now + MAX_QUEUE_AHEAD_TIME) {
                        console.warn(`PTT audio queue is ${(nextPlayTimeRef.current - now).toFixed(2)}s ahead. Resetting playback time.`);
                        nextPlayTimeRef.current = now;
                    }
                    
                    // If queue has fallen behind, reset to now.
                    if (nextPlayTimeRef.current < now) {
                        nextPlayTimeRef.current = now;
                    }
                    
                    // If it's a new transmission, play a beep and advance the queue cursor.
                    if (isNewTransmission) {
                        playBeep(audioContext, 1200, 0.15, 0.2); // Incoming alert beep
                        // Ensure the next audio chunk starts after the beep finishes
                        nextPlayTimeRef.current = Math.max(nextPlayTimeRef.current, now + 0.15);
                    }

                    const buffer = await base64ToAudioBuffer(payload.audio, audioContext);
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContext.destination);
                    
                    const startTime = nextPlayTimeRef.current;
                    source.start(startTime);
                    nextPlayTimeRef.current = startTime + buffer.duration;
                }
            }
        });
        
        const profileChannel = supabase.channel(`ptt-profiles-${profile.company_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `company_id=eq.${profile.company_id}`}, 
            (payload) => {
                setCompanyUsers(current => {
                    if (payload.eventType === 'UPDATE') {
                        return current.map(u => u.id === payload.new.id ? payload.new as Profile : u);
                    }
                    return current;
                });
            })
            .subscribe();

        channelRef.current = pttChannel;
        pttChannel.subscribe();

        return () => {
            supabase.removeChannel(pttChannel);
            supabase.removeChannel(profileChannel);
            channelRef.current = null;
            if (speakerTimeoutRef.current) {
                clearTimeout(speakerTimeoutRef.current);
            }
        };
    }, [isOpen, profile.company_id, profile.id]);
    
    const startTransmitting = async () => {
        try {
             if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            }
            playBeep(outputAudioContextRef.current, 1000, 0.15, 0.3); // Outgoing beep

            // Wait for the beep to finish before starting to record to avoid capturing it
            await new Promise(resolve => setTimeout(resolve, 150));

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Your browser does not support audio capture.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            mediaStreamRef.current = stream;

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const base64Audio = float32ToBase64(inputData);
                if (channelRef.current) {
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'audio-chunk',
                        payload: { audio: base64Audio, from: profile.id, target },
                    });
                }
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            setIsTransmitting(true);
        } catch (err: any) {
            addToast(`Microphone error: ${err.message}`, 'error');
            stopTransmitting();
        }
    };
    
    const stopTransmitting = () => {
        if (!isTransmitting) return; // Prevent multiple stop calls
        setIsTransmitting(false);
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4 mb-2 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <img src={profile.company?.logo_url || undefined} alt={`${profile.company?.name} Logo`} className="w-14 h-14 object-contain bg-gray-100 dark:bg-gray-800 rounded-md p-1" />
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">PTT Channel</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{profile.company?.name}</p>
                    </div>
                </div>

                <div className="mb-4">
                    <label htmlFor="ptt-target" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transmit To</label>
                    <select
                        id="ptt-target"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="all">All Users</option>
                        {companyUsers
                            .filter(user => user.id !== profile.id)
                            .map(user => (
                                <option key={user.id} value={user.id}>{user.full_name}</option>
                            ))
                        }
                    </select>
                </div>


                <div className="flex-grow space-y-2 h-56 overflow-y-auto pr-2">
                    {isLoading ? <p>Loading users...</p> : companyUsers.map(user => {
                        const isSelected = target === user.id;
                        const isSpeaking = activeSpeakerId === user.id;
                        return (
                            <div key={user.id} className={`flex items-center justify-between p-2 rounded-md transition-all duration-200 ${isSelected ? 'bg-blue-500/20' : 'bg-gray-50 dark:bg-gray-800/50'} ${isSpeaking ? 'ring-2 ring-green-500' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <img src={user.avatar_url || `https://i.pravatar.cc/40?u=${user.id}`} alt={user.full_name} className="w-8 h-8 rounded-full" />
                                    <span className="font-medium text-sm">{user.full_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isSpeaking ? (
                                        <span className="px-2 py-0.5 text-xs font-bold text-green-800 dark:text-green-200 bg-green-500/20 rounded-full animate-pulse">TALKING</span>
                                    ) : (
                                        <>
                                            <div className={`w-2.5 h-2.5 rounded-full ${isOnline(user.last_seen_at) ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{isOnline(user.last_seen_at) ? 'Online' : 'Offline'}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
                    <button
                        onMouseDown={startTransmitting}
                        onMouseUp={stopTransmitting}
                        onMouseLeave={stopTransmitting}
                        onTouchStart={startTransmitting}
                        onTouchEnd={stopTransmitting}
                        onTouchCancel={stopTransmitting}
                        className={`w-24 h-24 rounded-full border-4 transition-all duration-200 flex items-center justify-center mx-auto focus:outline-none ${
                            isTransmitting 
                            ? 'bg-red-500 border-red-300 text-white animate-pulse' 
                            : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                        }`}
                    >
                        <RadioTowerIcon className="w-10 h-10" />
                    </button>
                    <p className={`mt-4 font-semibold ${isTransmitting ? 'text-red-500' : 'text-gray-500'}`}>
                        {isTransmitting ? 'TRANSMITTING' : 'HOLD TO TALK'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PTTModal;
