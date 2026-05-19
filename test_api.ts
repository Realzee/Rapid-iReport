import fetch from 'node-fetch';

async function test() {
    const tables = ['sites', 'guards', 'routes', 'supervisors', 'checkpoints', 'patrol_logs'];
    for (const table of tables) {
        const res = await fetch(`http://127.0.0.1:3000/api/guard-monitoring?table=${table}&company_id=9e02e429-78a4-4fe8-9b16-b766be5c40da`);
        const text = await res.text();
        console.log(`Table ${table} ->`, text.substring(0, 100));
    }
}
test();
