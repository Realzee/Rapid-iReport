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
  removeChannel: (channel: any) => Promise.resolve()
};

// Return transparent proxy mock client if in sandbox mode
const isSandbox = typeof window !== 'undefined' && localStorage.getItem('rapid911_sandbox_mode') === 'true';

export const supabase = isSandbox
  ? (mockSupabase as any)
  : (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('undefined') && supabaseAnonKey !== 'undefined' && supabaseUrl.startsWith('http'))
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
