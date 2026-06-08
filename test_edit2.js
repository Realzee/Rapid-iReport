async function run() {
    const editPayload = {
        action: "edit",
        id: "legacy-10783",
        ob_number: "00088/6/2026", // whatever
        type: "STOLEN VEHICLE",
        company: "RAPID",
        vehicle_registration: "AB12CDGP",
        make: "TOYOTA",
        model: "HILUX",
        vin_number: "-",
        engine_number: "-",
        color: "YELLOW",
        reason: "Test reason UPDATE",
        entry_text: "Test entry text UPDATE",
        cos_name: "Test COS",
        cos_contact_number: "0820000000",
        case_number: "CAS 123/4/2026",
        station_reported_at: "JHB",
        io_name: "-",
        io_contact: "-",
        recovered: "RECOVERED",
        tracker: "No",
        date_of_incident: "2026-06-08"
    };
    
    const formData = new URLSearchParams();
    for (const [k, v] of Object.entries(editPayload)) {
        if (k !== 'action' && k !== 'id') formData.append(k, v);
    }
    
    const res = await fetch('https://rapidreportingsa.co.za/process_vehicle.php?action=update', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://rapidreportingsa.co.za/WORKING/ob.php'
        },
        body: formData.toString()
    });
    console.log(res.status);
    console.log(await res.text());
}
run();
