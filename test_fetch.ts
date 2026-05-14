fetch('http://127.0.0.1:3000/api/guard-monitoring', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'fix-schema' })
}).then(r => r.json()).then(console.log).catch(console.error);
