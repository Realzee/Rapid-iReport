async function run() {
    const res = await fetch('http://localhost:3000/api/legacy-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: 'legacy-10783' }) // delete AB12CDGP
    });
    console.log(res.status, await res.text());
}
run();
