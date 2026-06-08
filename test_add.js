async function run() {
    const legacyPayload = {
        action: "add",
        type: "STOLEN VEHICLE",
        company: "RAPID",
        vehicle_registration: "AB12CDGP",
        make: "TOYOTA",
        model: "HILUX",
        vin_number: "",
        engine_number: "",
        color: "WHITE",
        reason: "Test reason from agent script",
        entry_text: "Test entry text from agent script",
        cos_name: "Test COS",
        cos_contact_number: "0820000000",
        case_number: "CAS 123/4/2026",
        station_reported_at: "JHB",
        io_name: "",
        io_contact: "",
        recovered: "STOLEN",
        tracker: "No",
        date_of_incident: "2026-06-08"
    };
    const res = await fetch('http://localhost:3000/api/legacy-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacyPayload)
    });
    console.log(res.status, await res.text());
}
run();
