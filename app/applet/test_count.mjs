async function test() {
  const r = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php');
  const text = await r.text();
  const match = text.match(/Total Entries:.*?([\d,]+)/i);
  console.log("Match:", match ? match[1] : null);
}
test();
