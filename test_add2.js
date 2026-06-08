async function run() {
    const legacyPayload = {
        action: "add",
        type: "STOLEN VEHICLE",
        company: "RAPID",
        vehicle_registration: "AB20CDGP",
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
    
    let res = await fetch('http://localhost:3000/api/legacy-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacyPayload)
    });
    console.log("Add response:", await res.text());

    // Wait a sec, then query ob.php directly
    await new Promise(r => setTimeout(r, 1000));
    const obHtml = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php').then(r => r.text());
    const idx = obHtml.indexOf('AB20CDGP');
    if (idx > -1) {
        const start = obHtml.lastIndexOf('<tr>', idx);
        const end = obHtml.indexOf('</tr>', idx) + 5;
        console.log("Row HTML:\n", obHtml.substring(start, end));
    }
}
run();
