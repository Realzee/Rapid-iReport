async function run() {
    const res = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php');
    const text = await res.text();
    // find AB12CDGP
    const idx = text.indexOf('AB12CDGP');
    const rows = text.substring(idx - 200, idx + 100);
    console.log(rows);
}
run();
