async function run() {
    const res = await fetch('http://localhost:3000/api/legacy-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: 'legacy-10784' }) // delete AB20CDGP
    });
    console.log(res.status, await res.text());
}
run();
