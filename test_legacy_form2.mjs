async function test() {
  try {
    const r = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php');
    const html = await r.text();
    const index = html.indexOf("NEW VEHICLE LOG");
    if (index !== -1) {
        console.log(html.substring(index, index + 2000));
    }
  } catch(e) {
    console.error(e);
  }
}
test();
