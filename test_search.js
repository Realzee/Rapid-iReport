import https from 'https';

const data = new URLSearchParams({
  'search': 'vw',
});

const req = https.request('https://rapidreportingsa.co.za/WORKING/ob.php', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(data.toString())
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(body.substring(0, 1000));
    console.log("MATCHES:", body.match(/data-entry/g)?.length);
  });
});

req.write(data.toString());
req.end();
