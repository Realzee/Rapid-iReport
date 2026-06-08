async function run() {
    const res = await fetch('https://rapidreportingsa.co.za/UltimateRegApp.html');
    const text = await res.text();
    console.log(text.match(/<form[^>]*>/gi));
    // Let's also find all input names
    const inputs = [...text.matchAll(/<(?:input|select|textarea)[^>]*name=["']([^"']*)["'][^>]*>/gi)].map(m => m[1]);
    console.log("Inputs:", inputs);
}
run();
