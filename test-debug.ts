import "dotenv/config";
import fetch from "node-fetch";

async function run() {
  const url = 'https://yglwdwhwpbqawunbkzyy.supabase.co/rest/v1/sites?select=*&limit=1';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
  const res = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  console.log('status:', res.status, res.statusText);
  console.log('body:', await res.text());
}
run();
