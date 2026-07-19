const fs = require('fs');

let content = fs.readFileSync('components/FleetManagement.tsx', 'utf-8');

// 1. Add "Add Tracking Unit" button
const searchBoxStr = `          {/* Search Box */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-950">
            <div className="relative">`;

const newSearchBoxStr = `          {/* Search Box */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-950 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Tracking Units</h2>
              {(profile.role === 'admin' || profile.role === 'controller') && (
                <button 
                  onClick={() => {
                    setEditingUnit(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Add Unit
                </button>
              )}
            </div>
            <div className="relative">`;

content = content.replace(searchBoxStr, newSearchBoxStr);

// 2. Add Edit/Delete buttons inside the vehicle list item
const vehicleItemStr = `                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={\`w-2 h-2 rounded-full \${
                            isOffline ? 'bg-gray-400' : (veh.fuelCut ? 'bg-red-500' : (isStationary ? 'bg-amber-400' : 'bg-emerald-500'))
                          }\`} />
                          <h3 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {veh.name}
                          </h3>
                          <span className="text-[9px] font-semibold font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {veh.plate}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                          IMEI: {veh.imei}
                        </p>
                      </div>`;

const newVehicleItemStr = `                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={\`w-2 h-2 rounded-full \${
                            isOffline ? 'bg-gray-400' : (veh.fuelCut ? 'bg-red-500' : (isStationary ? 'bg-amber-400' : 'bg-emerald-500'))
                          }\`} />
                          <h3 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {veh.name}
                          </h3>
                          <span className="text-[9px] font-semibold font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {veh.plate}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mb-1.5">
                          IMEI: {veh.imei}
                        </p>
                        {(profile.role === 'admin' || profile.role === 'controller') && (
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingUnit({
                                  id: veh.id,
                                  name: veh.name,
                                  plate: veh.plate,
                                  imei: veh.imei,
                                  speed_limit: veh.speedLimit
                                });
                                setIsModalOpen(true);
                              }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm('Are you sure you want to delete this tracking unit?')) {
                                  try {
                                    const { error } = await supabase.from('tracking_units').delete().eq('id', veh.id);
                                    if (error) throw error;
                                    setVehicles(prev => prev.filter(v => v.id !== veh.id));
                                    if (selectedVehicleId === veh.id) setSelectedVehicleId(null);
                                    addToast('Tracking unit deleted successfully', 'success');
                                  } catch (err) {
                                    console.error(err);
                                    addToast('Failed to delete tracking unit', 'error');
                                  }
                                }
                              }}
                              className="text-[10px] text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>`;

content = content.replace(vehicleItemStr, newVehicleItemStr);

// 3. Add the Modal Component at the end of FleetManagement.tsx (inside the container div)
// We need to inject the <TrackingUnitModal /> before the last </div> of the component.
const lastDivIdx = content.lastIndexOf('</div>');
const modalStr = `
      <TrackingUnitModal
        profile={profile}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingUnit}
        onSave={(data) => {
          fetchTrackingUnits();
          setIsModalOpen(false);
          addToast(editingUnit ? "Tracking unit updated" : "Tracking unit added", "success");
        }}
      />
`;

if (lastDivIdx !== -1) {
  content = content.substring(0, lastDivIdx) + modalStr + content.substring(lastDivIdx);
}

fs.writeFileSync('components/FleetManagement.tsx', content);
console.log("Patched UI successfully");
