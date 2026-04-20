async function test() {
    const formData = new URLSearchParams();
    formData.append('search', 'ABC123GP');
    formData.append('submit-search', '');

    const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    });

    const html = await legacyRes.text();
    const results = [];
    const regex = /data-entry='(\{[\s\S]*?\})'/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        try {
            console.log("MATCH FOUND", match[1]);
            const rawJsonStr = match[1].replace(/&quot;/g, '"');
            const row = JSON.parse(rawJsonStr);
            results.push(row);
        } catch (e) {
            console.error("PARSE FAILED", e);
        }
    }
    console.log("RESULTS EXTRACTED:", results.length);
}
test();
