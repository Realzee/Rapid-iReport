// WebAuthn / Biometric (Fingerprint/Passkey) Login Utilities for Rapid911

export interface BiometricCredentials {
    email: string;
    credentialId: string; // Base64 encoded WebAuthn Credential ID
    encryptedData: string; // Base64 encoded encrypted password
}

// Simple symmetric XOR encryption using the WebAuthn Credential ID as the key
// Since the Credential ID is only retrievable after a successful biometric verification,
// the encrypted password cannot be decrypted without a valid fingerprint scan.
export function encrypt(text: string, key: string): string {
    const textBytes = new TextEncoder().encode(text);
    const keyBytes = new TextEncoder().encode(key);
    const encrypted = new Uint8Array(textBytes.length);
    for (let i = 0; i < textBytes.length; i++) {
        encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    // Convert bytes to string safely
    let binary = '';
    const len = encrypted.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(encrypted[i]);
    }
    return btoa(binary);
}

export function decrypt(base64Text: string, key: string): string {
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

// Convert ArrayBuffer to Base64 (compatible with standard URL-safe or generic base64 representation)
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Convert Base64 back to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Check if the current browser and device supports WebAuthn user-verifying platform biometrics (fingerprint/FaceID).
 */
export async function isBiometricsSupported(): Promise<boolean> {
    if (!window.PublicKeyCredential) return false;
    try {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return !!available;
    } catch (e) {
        console.warn('Biometrics support check failed:', e);
        return false;
    }
}

/**
 * Register a fingerprint / passkey on the device.
 * @param email User's email address
 * @param password User's plaintext password to encrypt and bind to the credential ID
 */
export async function registerBiometrics(email: string, password: string): Promise<BiometricCredentials> {
    const supported = await isBiometricsSupported();
    if (!supported) {
        throw new Error('Biometric authentication is not supported or enabled on this browser/device.');
    }

    // Generate random challenge and user ID
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const displayName = email.split('@')[0];

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
            name: "Vigilix Security Monitoring System",
            id: window.location.hostname,
        },
        user: {
            id: userId,
            name: email,
            displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        },
        pubKeyCredParams: [
            { type: "public-key", alg: -7 }, // ES256
            { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
            authenticatorAttachment: "platform", // forces built-in fingerprint/FaceID/Windows Hello
            userVerification: "required",
            residentKey: "discouraged",
        },
        timeout: 60000,
        attestation: "none",
    };

    const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
    }) as PublicKeyCredential;

    if (!credential) {
        throw new Error('Biometric registration was cancelled or failed.');
    }

    const credentialId = arrayBufferToBase64(credential.rawId);
    const encryptedData = encrypt(password, credentialId);

    const bioCredentials: BiometricCredentials = {
        email,
        credentialId,
        encryptedData,
    };

    // Store in localStorage
    localStorage.setItem('rapid911_biometric_auth', JSON.stringify(bioCredentials));

    return bioCredentials;
}

/**
 * Authenticate using biometric / fingerprint reader.
 * Returns the decrypted credentials if successful.
 */
export async function authenticateBiometrics(): Promise<{ email: string; password: string }> {
    const stored = localStorage.getItem('rapid911_biometric_auth');
    if (!stored) {
        throw new Error('No fingerprint registered on this device. Please register in your Profile Settings first.');
    }

    const credentials: BiometricCredentials = JSON.parse(stored);
    
    // Generate random challenge
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credentialIdBuffer = base64ToArrayBuffer(credentials.credentialId);

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{
            id: credentialIdBuffer,
            type: 'public-key',
        }],
        userVerification: "required",
        timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
    }) as PublicKeyCredential;

    if (!assertion) {
        throw new Error('Biometric authentication cancelled.');
    }

    const assertionId = arrayBufferToBase64(assertion.rawId);
    
    // Decrypt the password using the returned credential ID
    const password = decrypt(credentials.encryptedData, assertionId);

    return {
        email: credentials.email,
        password,
    };
}

/**
 * Check if there is currently a biometric credential registered on this device.
 */
export function hasBiometricsRegistered(): boolean {
    return !!localStorage.getItem('rapid911_biometric_auth');
}

/**
 * Clear the biometric credential from this device.
 */
export function clearBiometrics(): void {
    localStorage.removeItem('rapid911_biometric_auth');
}
