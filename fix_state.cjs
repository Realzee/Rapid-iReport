const fs = require('fs');

let content = fs.readFileSync('components/FleetManagement.tsx', 'utf-8');

const anchor = "  const [searchTerm, setSearchTerm] = useState('');";
const stateToInsert = `  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [activeSubTab, setActiveSubTab] = useState<'map' | 'telemetry' | 'terminal' | 'history'>('map');
  const [histories, setHistories] = useState<TripHistoryItem[]>([]);
  const [historySearchText, setHistorySearchText] = useState('');
  const [historyFilterType, setHistoryFilterType] = useState<'all' | 'moving' | 'stationary' | 'alert'>('all');
`;

content = content.replace(anchor, stateToInsert + '\\n' + anchor);
fs.writeFileSync('components/FleetManagement.tsx', content);
console.log("State fixed");
