async function test() {
    const formData = new URLSearchParams();
    formData.append('search', 'ABC123GP');
    formData.append('submit-search', '');

    const legacyRes = await fetch('https://rapidreportingsa.co.za/WORKING/ob.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    });

    const html = await legacyRes.text();
    const tableStart = html.indexOf('<table');
    const tableEnd = html.indexOf('</table>');
    if (tableStart !== -1 && tableEnd !== -1) {
        console.log(html.substring(tableStart, tableEnd + 8));
    } else {
        console.log("No table found");
        console.log(html.substring(0, 2000));
    }
}
test();
