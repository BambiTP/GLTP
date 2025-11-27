import fs from "fs";

const records = JSON.parse(fs.readFileSync("records.json", "utf8"));

// Add your password here
const PASSWORD = "";
const WORKER_URL = `https://gltp.fwotagprodad.workers.dev/upload?password=${PASSWORD}`;

async function uploadRecord(record) {
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });

    if (res.status === 201) {
      console.log(`✅ Added ${record.uuid}`);
    } else if (res.status === 409) {
      console.log(`⚠️ Duplicate ${record.uuid}, skipped`);
    } else if (res.status === 401) {
      console.log(`🔒 Unauthorized: check your password`);
    } else {
      console.log(`❌ Error for ${record.uuid}: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`❌ Failed for ${record.uuid}:`, err);
  }
}

async function main() {
  for (const record of records) {
    await uploadRecord(record);
  }
}

main();
