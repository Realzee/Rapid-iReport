import { createClient } from '@supabase/supabase-js';

const getSafeUrl = () => {
  const envUrl = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL);
  const defaultUrl = 'https://zbbsvtlnmjjkobfycudw.supabase.co';
  if (!envUrl || envUrl === 'undefined' || envUrl.trim() === '') return defaultUrl;
  const trimmed = envUrl.trim();
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

export const supabaseUrl = getSafeUrl();
export const supabaseAnonKey = ((typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiYnN2dGxubWpqa29iZnljdWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODI3MTMsImV4cCI6MjEwMDk1ODcxM30.PLeuqc3AKOq5QEFC2nxXIQ3MEEns5hxx7IkBYtzx43s').trim();

// Seed default mock database data for a beautiful, premium, pre-populated sandbox experience
function getMockDefaultData(tableName: string): any[] {
  const defaults: Record<string, any[]> = {
    companies: [
      {
        id: '81134758-0000-4000-8000-000000000000',
        name: 'Rapid Responders SA',
        alias: 'rapid-responders',
        logo_url: null,
        bolo_background_url: null,
        owners_name: 'Zweli Mst',
        address: '15 Sandton Drive, Sandton, Johannesburg',
        contact_person: 'Zweli Admin',
        cell_number: '+27 82 123 4567',
        psira_number: 'PSIRA-849301',
        allowed_modules: ['controller', 'tech_ops', 'fleet_management', 'guard_monitoring', 'gate_access', 'attendance', 'analytics', 'archives'],
        created_at: new Date().toISOString(),
        status: 'approved'
      }
    ],
    profiles: [
      {
        id: 'd068451b-7733-4425-a35b-720af5bb286a',
        email: 'zweli@msn.com',
        first_name: 'Zweli',
        surname: 'Admin',
        role: 'admin',
        status: 'active',
        company_id: '81134758-0000-4000-8000-000000000000'
      },
      {
        id: 'user-controller-1',
        email: 'john@rapid.co.za',
        first_name: 'John',
        surname: 'Controller',
        role: 'controller',
        status: 'active',
        company_id: '81134758-0000-4000-8000-000000000000'
      },
      {
        id: 'user-responder-1',
        email: 'sarah@rapid.co.za',
        first_name: 'Sarah',
        surname: 'Responder',
        role: 'responder',
        status: 'active',
        company_id: '81134758-0000-4000-8000-000000000000'
      }
    ],
    vehicle_reports: [
      {
        id: 'report-v-1',
        ob_number: 'OB-V-10023',
        license_plate: 'GP 458 RT',
        vehicle_make: 'Toyota',
        vehicle_model: 'Hilux',
        vehicle_color: 'White',
        last_seen_location: 'Sandton Drive, Johannesburg',
        description: 'Suspicious vehicle spotted idling near residential entrances multiple times.',
        severity: 'medium',
        status: 'pending',
        reported_by: 'user-responder-1',
        company_id: '81134758-0000-4000-8000-000000000000',
        reported_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        location_coords: { lat: -26.1015, lng: 28.0567 }
      },
      {
        id: 'report-v-2',
        ob_number: 'OB-V-10024',
        license_plate: 'ND 887-542',
        vehicle_make: 'Volkswagen',
        vehicle_model: 'Polo',
        vehicle_color: 'Silver',
        last_seen_location: 'William Nicol Dr, Bryanston',
        description: 'Reported stolen from shopping center parking lot.',
        severity: 'high',
        status: 'active',
        reported_by: 'user-responder-1',
        company_id: '81134758-0000-4000-8000-000000000000',
        reported_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        location_coords: { lat: -26.0415, lng: 28.0241 }
      }
    ],
    crime_reports: [
      {
        id: 'report-c-1',
        ob_number: 'OB-C-30012',
        title: 'House Breaking in Progress',
        description: 'Two suspects climbing over boundary wall. Armed response dispatched.',
        severity: 'high',
        status: 'active',
        reported_by: 'user-responder-1',
        company_id: '81134758-0000-4000-8000-000000000000',
        reported_at: new Date(Date.now() - 1800000).toISOString(),
        location_coords: { lat: -26.0950, lng: 28.0450 }
      }
    ],
    emergency_reports: [
      {
        id: 'report-e-1',
        ob_number: 'OB-E-40056',
        title: 'Motor Vehicle Accident',
        description: 'Two-vehicle collision near main intersection. Paramedics on scene.',
        severity: 'high',
        status: 'completed',
        reported_by: 'user-responder-1',
        company_id: '81134758-0000-4000-8000-000000000000',
        reported_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        location_coords: { lat: -26.1100, lng: 28.0620 }
      }
    ],
    tracking_units: [
      {
        id: 'unit-1',
        name: 'Alpha Patrol Unit',
        plate: 'GP 458 RT',
        imei: '863587041234567',
        status: 'moving',
        lat: -26.1015,
        lng: 28.0567,
        speed: 45,
        course: 120,
        battery_voltage: 12.8,
        battery_percent: 98,
        acc_status: true,
        fuel_cut: false,
        mileage: 12450.5,
        fuel_level: 85,
        company_id: '81134758-0000-4000-8000-000000000000',
        updated_at: new Date().toISOString()
      },
      {
        id: 'unit-2',
        name: 'Bravo Interceptor Unit',
        plate: 'ND 887-542',
        imei: '863587041234568',
        status: 'stationary',
        lat: -26.0415,
        lng: 28.0241,
        speed: 0,
        course: 0,
        battery_voltage: 12.4,
        battery_percent: 100,
        acc_status: false,
        fuel_cut: false,
        mileage: 8520.1,
        fuel_level: 60,
        company_id: '81134758-0000-4000-8000-000000000000',
        updated_at: new Date().toISOString()
      }
    ],
    patrol_logs: [
      {
        id: 'patrol-1',
        guard_name: 'Sipho Ndlovu',
        checkpoint: 'Main Gate Sector A',
        status: 'completed',
        logged_at: new Date(Date.now() - 1200000).toISOString(),
        company_id: '81134758-0000-4000-8000-000000000000'
      }
    ],
    guard_heartbeats: [
      {
        id: 'hb-1',
        guard_name: 'Sipho Ndlovu',
        device_id: 'dev-01',
        status: 'online',
        last_ping: new Date().toISOString(),
        company_id: '81134758-0000-4000-8000-000000000000'
      }
    ],
    app_settings: [
      { key: 'main_logo_url', value: null },
      { key: 'favicon_url', value: null }
    ],
    announcements: [
      {
        id: 'ann-1',
        title: 'System Launch Scheduled',
        content: 'We are proud to introduce the new Rapid iReport platform.',
        category: 'general',
        is_active: true,
        created_at: new Date().toISOString()
      }
    ]
  };
  return defaults[tableName] || [];
}

class MockQueryBuilder {
  private tableName: string;
  private filters: any[] = [];
  private orderCol: string | null = null;
  private limitNum: number | null = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(cols?: string) {
    return this;
  }

  insert(data: any) {
    const records = this.getRecords();
    const isArray = Array.isArray(data);
    const newData = isArray ? data : [data];
    const inserted: any[] = [];
    
    for (const item of newData) {
      const record = { 
        id: item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'mock-id-' + Math.floor(Math.random() * 10000000)), 
        ...item, 
        created_at: new Date().toISOString() 
      };
      records.push(record);
      inserted.push(record);
    }
    
    this.setRecords(records);
    return Promise.resolve({ data: isArray ? inserted : inserted[0], error: null });
  }

  update(data: any) {
    let records = this.getRecords();
    const updated: any[] = [];
    
    records = records.map(r => {
      if (this.matchesFilters(r)) {
        const updatedRecord = { ...r, ...data, updated_at: new Date().toISOString() };
        updated.push(updatedRecord);
        return updatedRecord;
      }
      return r;
    });
    
    this.setRecords(records);
    return Promise.resolve({ data: updated, error: null });
  }

  delete() {
    const records = this.getRecords();
    const remaining = records.filter(r => !this.matchesFilters(r));
    this.setRecords(remaining);
    return Promise.resolve({ data: [], error: null });
  }

  eq(col: string, val: any) {
    this.filters.push({ type: 'eq', col, val });
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push({ type: 'in', col, vals });
    return this;
  }

  or(query: string) {
    return this;
  }

  order(col: string, options?: any) {
    this.orderCol = col;
    return this;
  }

  limit(num: number) {
    this.limitNum = num;
    return this;
  }

  async maybeSingle() {
    const { data } = await this.execute();
    return { data: data && data.length > 0 ? data[0] : null, error: null };
  }

  async single() {
    const { data } = await this.execute();
    if (!data || data.length === 0) {
      return { data: null, error: { message: 'No rows found in sandbox' } };
    }
    return { data: data[0], error: null };
  }

  then(onfulfilled?: (value: any) => any) {
    return this.execute().then(onfulfilled);
  }

  private getRecords(): any[] {
    const key = `mock_db_${this.tableName}`;
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    
    const defaults = getMockDefaultData(this.tableName);
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }

  private setRecords(records: any[]) {
    const key = `mock_db_${this.tableName}`;
    localStorage.setItem(key, JSON.stringify(records));
  }

  private matchesFilters(record: any): boolean {
    for (const f of this.filters) {
      if (f.type === 'eq') {
        if (record[f.col] !== f.val) return false;
      } else if (f.type === 'in') {
        if (!f.vals.includes(record[f.col])) return false;
      }
    }
    return true;
  }

  private async execute() {
    let records = this.getRecords();
    records = records.filter(r => this.matchesFilters(r));
    
    if (this.tableName === 'profiles') {
      const companiesKey = `mock_db_companies`;
      const companiesStored = localStorage.getItem(companiesKey);
      const companiesList = companiesStored ? JSON.parse(companiesStored) : getMockDefaultData('companies');
      
      records = records.map(r => {
        const company = companiesList.find((c: any) => c.id === r.company_id);
        return {
          ...r,
          company: company || null
        };
      });
    }

    if (this.orderCol) {
      records.sort((a, b) => {
        const valA = a[this.orderCol!];
        const valB = b[this.orderCol!];
        if (valA < valB) return 1;
        if (valA > valB) return -1;
        return 0;
      });
    }

    if (this.limitNum !== null) {
      records = records.slice(0, this.limitNum);
    }

    return { data: records, error: null };
  }
}

const mockSession = {
  access_token: 'mock-access-token-zweli-admin',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'd068451b-7733-4425-a35b-720af5bb286a',
    email: 'zweli@msn.com',
    role: 'authenticated',
    user_metadata: {
      first_name: 'Zweli',
      surname: 'Admin'
    }
  }
};

const mockProfile = {
  id: 'd068451b-7733-4425-a35b-720af5bb286a',
  email: 'zweli@msn.com',
  first_name: 'Zweli',
  surname: 'Admin',
  role: 'admin',
  status: 'active',
  company_id: '81134758-0000-4000-8000-000000000000',
  company: {
    id: '81134758-0000-4000-8000-000000000000',
    name: 'Rapid Responders SA',
    alias: 'rapid-responders',
    allowed_modules: ['controller', 'tech_ops', 'fleet_management', 'guard_monitoring', 'gate_access', 'attendance', 'analytics', 'archives'],
    status: 'approved'
  }
};

class MockChannel {
  private channelId: string;

  constructor(channelId: string) {
    this.channelId = channelId;
  }

  on(event: string, filter: any, callback: any) {
    return this;
  }

  subscribe(callback?: any) {
    if (callback) {
      setTimeout(() => callback('SUBSCRIBED'), 0);
    }
    return this;
  }

  unsubscribe() {
    return Promise.resolve();
  }

  send(payload: any) {
    return Promise.resolve('ok');
  }

  track(state: any) {
    return Promise.resolve('ok');
  }
}

const mockStorageInMemory = new Map<string, string>();

function dataURLtoBlob(dataurl: string): Blob | null {
  try {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error("Failed to convert dataURL to Blob", e);
    return null;
  }
}

class MockStorageBucket {
  private bucketName: string;
  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }
  async upload(filePath: string, file: any, options?: any) {
    const key = `mock_storage_${this.bucketName}_${filePath}`;
    if (file instanceof Blob || file instanceof File) {
      try {
        const objectUrl = URL.createObjectURL(file);
        mockStorageInMemory.set(key, objectUrl);
      } catch (e) {
        console.error("Error creating Object URL:", e);
      }

      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Upgrade the in-memory value to full persistent-ready Base64
          mockStorageInMemory.set(key, base64data);
          try {
            localStorage.setItem(key, base64data);
          } catch (storageError) {
            console.warn("Storage quota exceeded, keeping in-memory only:", storageError);
          }
        };
        reader.readAsDataURL(file);
      } catch (e) {
        console.error("Error reading file:", e);
      }
    }
    return { data: { path: filePath }, error: null };
  }
  async remove(paths: string[]) {
    for (const p of paths) {
      const key = `mock_storage_${this.bucketName}_${p}`;
      mockStorageInMemory.delete(key);
      localStorage.removeItem(key);
    }
    return { data: [], error: null };
  }
  getPublicUrl(filePath: string) {
    return { data: { publicUrl: `https://mock-storage.local/${this.bucketName}/${filePath}` } };
  }
}

class MockStorage {
  from(bucketName: string) {
    return new MockStorageBucket(bucketName);
  }
}

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
    onAuthStateChange: (callback: any) => {
      setTimeout(() => callback('SIGNED_IN', mockSession), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signOut: () => {
      localStorage.removeItem('rapid911_sandbox_mode');
      localStorage.removeItem('auth_session');
      localStorage.removeItem('user_profile');
      window.location.reload();
      return Promise.resolve({ error: null });
    }
  },
  from: (table: string) => new MockQueryBuilder(table),
  rpc: (fn: string, args?: any) => {
    if (fn === 'get_enum_values') {
      return Promise.resolve({ data: ['pending', 'active', 'completed', 'deleted'], error: null });
    }
    return Promise.resolve({ data: [], error: null });
  },
  channel: (channelId: string) => new MockChannel(channelId),
  removeChannel: (channel: any) => Promise.resolve(),
  storage: new MockStorage()
};

// Return transparent proxy mock client if in sandbox mode
const isSandbox = typeof window !== 'undefined' && localStorage.getItem('rapid911_sandbox_mode') === 'true';

// Helper to retrieve and resolve mock storage URLs to their base64/blob equivalents
function getMockStorageValue(url: string): string | null {
  try {
    const cleanUrl = url.split('?')[0]; // strip query parameters or timestamp cache-busters
    if (cleanUrl.includes('mock-storage.local/')) {
      const parts = cleanUrl.split('mock-storage.local/');
      if (parts.length > 1) {
        const subPath = parts[1]; // e.g. "company-logos/some-company-id/logo.png"
        const slashIndex = subPath.indexOf('/');
        if (slashIndex !== -1) {
          const bucketName = subPath.substring(0, slashIndex);
          const filePath = subPath.substring(slashIndex + 1);
          const key = `mock_storage_${bucketName}_${filePath}`;
          
          // Check in-memory map first
          const inMemoryUrl = mockStorageInMemory.get(key);
          if (inMemoryUrl) return inMemoryUrl;
          
          // Check localStorage
          const persistedUrl = localStorage.getItem(key);
          if (persistedUrl) return persistedUrl;
        }
      }
    }
  } catch (e) {
    console.error("Error retrieving mock storage value:", e);
  }
  return null;
}

// Monkey-patch HTMLImageElement.prototype.src to transparently resolve mock-storage.local URLs to Base64
if (isSandbox && typeof window !== 'undefined') {
  const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (originalSrcDescriptor && originalSrcDescriptor.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      get() {
        return originalSrcDescriptor.get ? originalSrcDescriptor.get.call(this) : '';
      },
      set(value) {
        let finalValue = value;
        if (typeof value === 'string' && value.includes('mock-storage.local/')) {
          const resolved = getMockStorageValue(value);
          if (resolved) {
            finalValue = resolved;
          } else {
            // Fallback placeholder
            finalValue = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=250&auto=format&fit=crop&q=80';
          }
        }
        originalSrcDescriptor.set!.call(this, finalValue);
      }
    });
  }
}

// Global localStorage.setItem override to handle QuotaExceededError and private browsing restrictions safely
if (typeof window !== 'undefined') {
  const originalSetItem = window.localStorage.setItem;
  window.localStorage.setItem = function(key: string, value: string) {
    try {
      originalSetItem.call(window.localStorage, key, value);
    } catch (e) {
      console.warn(`[localStorage Override] Failed to set "${key}" (likely quota exceeded or private mode):`, e);
    }
  };
}

// Inject network-level fetch mock when in sandbox mode to bypass backend API dependencies
if (isSandbox && typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    const method = init?.method?.toUpperCase() || 'GET';

    // Intercept mock-storage.local fetch requests (used for PDF generator/canvas context)
    if (url.includes('mock-storage.local/')) {
      const mockValue = getMockStorageValue(url);
      if (mockValue) {
        const blob = dataURLtoBlob(mockValue);
        if (blob) {
          return new Response(blob, {
            status: 200,
            headers: { 'Content-Type': blob.type }
          });
        }
      }
      // Fail-safe mock response
      return new Response(new Blob([], { type: 'image/png' }), {
        status: 200,
        headers: { 'Content-Type': 'image/png' }
      });
    }

    const parsedUrl = new URL(url, window.location.origin);
    const path = parsedUrl.pathname;

    if (path.startsWith('/api/')) {
      console.log(`[Sandbox Network Interceptor] Mocking ${method} ${path}`);
      
      // 1. GET /api/companies
      if (path === '/api/companies' && method === 'GET') {
        const stored = localStorage.getItem('mock_db_companies');
        const companies = stored ? JSON.parse(stored) : getMockDefaultData('companies');
        return new Response(JSON.stringify(companies), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 2. POST /api/companies
      if (path === '/api/companies' && method === 'POST') {
        const body = JSON.parse(init?.body as string || '{}');
        const stored = localStorage.getItem('mock_db_companies');
        const companies = stored ? JSON.parse(stored) : getMockDefaultData('companies');
        
        let savedCompany;
        if (body.id) {
          const index = companies.findIndex((c: any) => c.id === body.id);
          if (index !== -1) {
            companies[index] = { ...companies[index], ...body };
            savedCompany = companies[index];
          } else {
            savedCompany = { id: body.id, ...body, created_at: new Date().toISOString() };
            companies.push(savedCompany);
          }
        } else {
          const newId = crypto.randomUUID ? crypto.randomUUID() : 'company-' + Math.floor(Math.random() * 1000000);
          savedCompany = { id: newId, ...body, created_at: new Date().toISOString() };
          companies.push(savedCompany);
        }
        localStorage.setItem('mock_db_companies', JSON.stringify(companies));
        return new Response(JSON.stringify(savedCompany), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 3. DELETE /api/companies
      if (path === '/api/companies' && method === 'DELETE') {
        const body = JSON.parse(init?.body as string || '{}');
        const stored = localStorage.getItem('mock_db_companies');
        let companies = stored ? JSON.parse(stored) : getMockDefaultData('companies');
        companies = companies.filter((c: any) => c.id !== body.id);
        localStorage.setItem('mock_db_companies', JSON.stringify(companies));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 4. POST /api/update-setting
      if (path === '/api/update-setting' && method === 'POST') {
        const body = JSON.parse(init?.body as string || '{}');
        const { key, value } = body;
        const stored = localStorage.getItem('mock_db_app_settings');
        const settings = stored ? JSON.parse(stored) : getMockDefaultData('app_settings');
        const index = settings.findIndex((s: any) => s.key === key);
        if (index !== -1) {
          settings[index].value = value;
        } else {
          settings.push({ key, value });
        }
        localStorage.setItem('mock_db_app_settings', JSON.stringify(settings));
        return new Response(JSON.stringify({ key, value }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 5. GET /api/announcements
      if (path === '/api/announcements' && method === 'GET') {
        const stored = localStorage.getItem('mock_db_announcements');
        const announcements = stored ? JSON.parse(stored) : getMockDefaultData('announcements');
        return new Response(JSON.stringify(announcements), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 6. POST /api/announcements
      if (path === '/api/announcements' && method === 'POST') {
        const body = JSON.parse(init?.body as string || '{}');
        const stored = localStorage.getItem('mock_db_announcements');
        const announcements = stored ? JSON.parse(stored) : getMockDefaultData('announcements');
        
        let savedAnnouncement;
        if (body.id) {
          const index = announcements.findIndex((a: any) => a.id === body.id);
          if (index !== -1) {
            announcements[index] = { ...announcements[index], ...body };
            savedAnnouncement = announcements[index];
          } else {
            savedAnnouncement = { id: body.id, ...body, created_at: new Date().toISOString() };
            announcements.push(savedAnnouncement);
          }
        } else {
          const newId = crypto.randomUUID ? crypto.randomUUID() : 'announcement-' + Math.floor(Math.random() * 1000000);
          savedAnnouncement = { id: newId, ...body, created_at: new Date().toISOString() };
          announcements.push(savedAnnouncement);
        }
        localStorage.setItem('mock_db_announcements', JSON.stringify(announcements));
        return new Response(JSON.stringify(savedAnnouncement), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 7. DELETE /api/announcements
      if (path === '/api/announcements' && method === 'DELETE') {
        const body = JSON.parse(init?.body as string || '{}');
        const stored = localStorage.getItem('mock_db_announcements');
        let announcements = stored ? JSON.parse(stored) : getMockDefaultData('announcements');
        announcements = announcements.filter((a: any) => a.id !== body.id);
        localStorage.setItem('mock_db_announcements', JSON.stringify(announcements));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 8. POST /api/update-profile
      if (path === '/api/update-profile' && method === 'POST') {
        const body = JSON.parse(init?.body as string || '{}');
        const { id, ...updates } = body;
        const stored = localStorage.getItem('mock_db_profiles');
        const profiles = stored ? JSON.parse(stored) : getMockDefaultData('profiles');
        
        let updatedProfile = null;
        const index = profiles.findIndex((p: any) => p.id === id);
        if (index !== -1) {
          profiles[index] = { ...profiles[index], ...updates };
          updatedProfile = profiles[index];
        } else {
          updatedProfile = { id, ...updates };
          profiles.push(updatedProfile);
        }
        localStorage.setItem('mock_db_profiles', JSON.stringify(profiles));

        const currProfileStr = localStorage.getItem('user_profile');
        if (currProfileStr) {
          const currProfile = JSON.parse(currProfileStr);
          if (currProfile.id === id) {
            localStorage.setItem('user_profile', JSON.stringify({ ...currProfile, ...updates }));
          }
        }

        return new Response(JSON.stringify(updatedProfile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 9. POST /api/admin-users
      if (path === '/api/admin-users' && method === 'POST') {
        const body = JSON.parse(init?.body as string || '{}');
        const { action, id, email, first_name, surname, role, company_id } = body;
        const stored = localStorage.getItem('mock_db_profiles');
        let profiles = stored ? JSON.parse(stored) : getMockDefaultData('profiles');
        
        if (action === 'delete') {
          profiles = profiles.filter((p: any) => p.id !== id);
          localStorage.setItem('mock_db_profiles', JSON.stringify(profiles));
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        let savedProfile;
        if (id) {
          const index = profiles.findIndex((p: any) => p.id === id);
          if (index !== -1) {
            profiles[index] = { ...profiles[index], email, first_name, surname, role, company_id };
            savedProfile = profiles[index];
          } else {
            savedProfile = { id, email, first_name, surname, role, company_id, status: 'active' };
            profiles.push(savedProfile);
          }
        } else {
          const newId = crypto.randomUUID ? crypto.randomUUID() : 'user-' + Math.floor(Math.random() * 1000000);
          savedProfile = { id: newId, email, first_name, surname, role, company_id, status: 'active' };
          profiles.push(savedProfile);
        }
        
        localStorage.setItem('mock_db_profiles', JSON.stringify(profiles));
        return new Response(JSON.stringify({ success: true, profile: savedProfile }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 10. POST /api/reset-password
      if (path === '/api/reset-password') {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 11. GET /api/profiles
      if (path === '/api/profiles' && method === 'GET') {
        const stored = localStorage.getItem('mock_db_profiles');
        const profiles = stored ? JSON.parse(stored) : getMockDefaultData('profiles');
        return new Response(JSON.stringify(profiles), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 12. GET/POST /api/guard-monitoring
      if (path.includes('/api/guard-monitoring')) {
        const storedLogs = localStorage.getItem('mock_db_patrol_logs') || '[]';
        const parsedLogs = JSON.parse(storedLogs);
        
        if (method === 'GET') {
          return new Response(JSON.stringify({
            logs: parsedLogs,
            checkpoints: [
              { id: 'cp-1', name: 'Main Gate Sector A', location_coords: { lat: -26.1015, lng: 28.0567 } },
              { id: 'cp-2', name: 'Guard Room', location_coords: { lat: -26.1020, lng: 28.0572 } },
              { id: 'cp-3', name: 'North Perimeter Fence', location_coords: { lat: -26.1010, lng: 28.0560 } }
            ],
            schedules: []
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (method === 'POST') {
          const body = JSON.parse(init?.body as string || '{}');
          const newLog = {
            id: crypto.randomUUID ? crypto.randomUUID() : 'log-' + Math.floor(Math.random() * 1000000),
            guard_name: body.guard_name || 'Mock Guard',
            checkpoint: body.checkpoint || 'Main Gate Sector A',
            status: body.status || 'completed',
            logged_at: new Date().toISOString(),
            company_id: '81134758-0000-4000-8000-000000000000'
          };
          parsedLogs.unshift(newLog);
          localStorage.setItem('mock_db_patrol_logs', JSON.stringify(parsedLogs));
          return new Response(JSON.stringify({ success: true, log: newLog }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 13. Geocoding and utilities
      if (path.includes('/api/reverse-geocode')) {
        const lat = parsedUrl.searchParams.get('lat');
        const lng = parsedUrl.searchParams.get('lng');
        return new Response(JSON.stringify({
          display_name: `Mock Location near Sandton Drive (${lat}, ${lng}), Johannesburg`
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (path.includes('/api/geocode')) {
        const query = parsedUrl.searchParams.get('q') || '';
        return new Response(JSON.stringify([
          {
            display_name: `${query || 'Mock Address'}, Johannesburg, South Africa`,
            lat: -26.1015,
            lon: 28.0567
          }
        ]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (path.includes('/api/saps-boundaries')) {
        return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (path.includes('/api/resolve-maps-link')) {
        return new Response(JSON.stringify({ 
          success: true, 
          coords: { lat: -26.1015, lng: 28.0567 },
          address: 'Resolved Mock Address, Sandton, Johannesburg'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (path.includes('/api/legacy-api')) {
        return new Response(JSON.stringify({ count: 0, reports: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return originalFetch(input, init);
  };
}

export const supabase = isSandbox
  ? (mockSupabase as any)
  : (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('undefined') && supabaseAnonKey !== 'undefined' && supabaseUrl.startsWith('http'))
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
