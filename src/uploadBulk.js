import fs from "fs";

// Load records.json
const records = JSON.parse(fs.readFileSync("records.json", "utf8"));

// Add your password here
const PASSWORD = "";
const WORKER_URL = `https://gltp.fwotagprodad.workers.dev/bulk-upload?password=${PASSWORD}`;

async function bulkUpload(records) {
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(records), // send full array
    });

    if (res.ok) {
      const summary = await res.json();
      console.log("Bulk upload summary:", summary);
    } else if (res.status === 401) {
      console.log("🔒 Unauthorized: check your password");
    } else {
      console.log(`❌ Bulk upload failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("❌ Bulk upload request failed:", err);
  } 
}

async function main() {
  await bulkUpload(records);
}

main();
