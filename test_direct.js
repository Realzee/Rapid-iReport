async function run() {
    const legacyPayload = {
        action: "add",
        type: "STOLEN VEHICLE",
        company: "RAPID",
        vehicle_registration: "AB12CDGP",
        make: "TOYOTA",
        model: "HILUX",
        vin_number: "none",
        engine_number: "none",
        color: "WHITE",
        reason: "Test reason from agent script",
        entry_text: "Test entry text from agent script",
        cos_name: "Test COS",
        cos_contact_number: "0820000000",
        case_number: "CAS 123/4/2026",
        station_reported_at: "JHB",
        io_name: "none",
        io_contact: "none",
        recovered: "STOLEN",
        tracker: "No",
        date_of_incident: "2026-06-08"
    };
    
    const formData = new URLSearchParams();
    for (const [k, v] of Object.entries(legacyPayload)) {
        if (k !== 'action') formData.append(k, v);
    }
    
    const res = await fetch('https://rapidreportingsa.co.za/process_intake.php', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://rapidreportingsa.co.za/UltimateRegApp.html'
        },
        body: formData.toString()
    });
    console.log(res.status);
    console.log(await res.text());
}
run();
