async function test() {
  try {
    const r = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php');
    const html = await r.text();
    const formMatch = html.match(/<form[^>]*>.*?<\/form>/isg);
    if (formMatch) {
      console.log("Forms found:", formMatch.length);
      console.log(formMatch[0].substring(0, 1000)); // Print first form
    } else {
      console.log("No forms found");
    }
  } catch(e) {
    console.error(e);
  }
}
test();
