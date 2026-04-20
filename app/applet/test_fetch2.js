async function test() {
  const r = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php');
  const text = await r.text();
  console.log("Length:", text.length);
  const match = text.match(/Total Entries.*?(\d+)/is);
  if (match) {
    console.log("Found match:", match[1]);
  } else {
    console.log("No match found.");
    // search for any large numbers
    const numMatches = text.match(/\d{4,}/g);
    console.log("Large numbers in HTML:", numMatches?.slice(0, 5));
    // Let's also search for 'Total'
    const totalMatch = text.match(/.{0,20}Total.{0,20}/igs);
    console.log("Total appearances:", totalMatch);
  }
}
test();
