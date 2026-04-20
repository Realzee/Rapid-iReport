async function test() {
  const r = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php');
  const text = await r.text();
  const match1 = text.match(/Total Entries:.*?([\d,]+)/is);
  const match2 = text.match(/TOTAL RECORDS:.*?([\d,]+)/is);
  console.log("Match1:", match1 ? match1[1] : null);
  console.log("Match2:", match2 ? match2[1] : null);
}
test();
