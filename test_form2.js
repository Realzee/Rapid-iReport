async function run() {
    const res = await fetch('https://rapidreportingsa.co.za/UltimateRegApp.html');
    const text = await res.text();
    const typeMatch = text.match(/<[^>]*name=["']type["'][^>]*>/gi);
    console.log("type field:", typeMatch);
}
run();
