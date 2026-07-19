const fs = require('fs');

let content = fs.readFileSync('components/FleetManagement.tsx', 'utf-8');

// Replace the vehicles state initialization
const startIdx = content.indexOf('const [vehicles, setVehicles] = useState<TK116Device[]>([');
const endIdx = content.indexOf('  const [searchTerm, setSearchTerm] = useState(\'\');');

const replacement = `  const [vehicles, setVehicles] = useState<TK116Device[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);

  const fetchTrackingUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('tracking_units')
        .select('*')
        .eq('company_id', profile.company_id);
      
      if (error) throw error;
      
      if (data) {
        setVehicles(data.map(d => ({
          id: d.id,
          name: d.name,
          plate: d.plate,
          imei: d.imei,
          status: d.status as any,
          lat: d.lat || 0,
          lng: d.lng || 0,
          speed: d.speed || 0,
          course: d.course || 0,
          batteryVoltage: d.battery_voltage || 0,
          batteryPercent: d.battery_percent || 0,
          accStatus: d.acc_status || false,
          fuelCut: d.fuel_cut || false,
          mileage: d.mileage || 0,
          fuelLevel: d.fuel_level || 0,
          lastUpdate: new Date(d.updated_at).toLocaleTimeString(),
          speedLimit: d.speed_limit || 100,
          pathHistory: [],
          alerts: []
        })));
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch tracking units", "error");
    }
  };

  useEffect(() => {
    fetchTrackingUnits();
  }, [profile.company_id]);

`;

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
  fs.writeFileSync('components/FleetManagement.tsx', content);
  console.log("Patched vehicles state successfully");
} else {
  console.log("Could not find indices");
}
