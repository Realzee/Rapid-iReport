// Facial Recognition Security Utilities for Rapid911

export interface FaceCredentials {
    email: string;
    registeredAt: string;
    encryptedData: string; // Base64 encoded encrypted password
    faceDataUrl?: string; // Snapshot of the registered face for visual profile verification
}

// Simple XOR Encryption using a static local salt combined with email to safeguard passwords
export function encryptFaceData(text: string, email: string): string {
    const key = `face_key_salt_${email}_911`;
    const textBytes = new TextEncoder().encode(text);
    const keyBytes = new TextEncoder().encode(key);
    const encrypted = new Uint8Array(textBytes.length);
    for (let i = 0; i < textBytes.length; i++) {
        encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    let binary = '';
    const len = encrypted.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(encrypted[i]);
    }
    return btoa(binary);
}

export function decryptFaceData(base64Text: string, email: string): string {
    const key = `face_key_salt_${email}_911`;
    const binary = atob(base64Text);
    const encrypted = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        encrypted[i] = binary.charCodeAt(i);
    }
    
    const keyBytes = new TextEncoder().encode(key);
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
        decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
    }
    return new TextDecoder().decode(decrypted);
}

/**
 * Check if the browser supports camera capture for facial recognition.
 */
export async function isFaceAuthSupported(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
    }
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.kind === 'videoinput');
    } catch (e) {
        console.warn('Camera devices check failed:', e);
        return false;
    }
}

/**
 * Check if a facial profile is already enrolled on this device.
 */
export function hasFaceRegistered(): boolean {
    return !!localStorage.getItem('rapid911_face_auth');
}

/**
 * Retrieve the current enrolled face credential info.
 */
export function getFaceCredentials(): FaceCredentials | null {
    const stored = localStorage.getItem('rapid911_face_auth');
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch (e) {
        return null;
    }
}

/**
 * Enroll face profile.
 */
export function registerFaceAuth(email: string, password: string, faceDataUrl: string): FaceCredentials {
    const encryptedData = encryptFaceData(password, email);
    const credentials: FaceCredentials = {
        email,
        registeredAt: new Date().toISOString(),
        encryptedData,
        faceDataUrl
    };
    localStorage.setItem('rapid911_face_auth', JSON.stringify(credentials));
    return credentials;
}

/**
 * Clear facial recognition enrollment.
 */
export function clearFaceAuth(): void {
    localStorage.removeItem('rapid911_face_auth');
}
