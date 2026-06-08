async function run() {
    const obHtml = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php').then(r => r.text());
    console.log(obHtml.includes('AB20CDGP'));
}
run();
