// bot.js
import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import { parseReplayFromUUID, parseReplayFromReplayLink } from "./replayParserDiscord.js"; // adjust path

// Replace with your bot token and Worker details
const DISCORD_TOKEN = "";
const CHANNEL_ID = ""; 
const WORKER_URL = "https://gltp.fwotagprodad.workers.dev/upload";
const PASSWORD = "";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Unified parser
function validateInput(input) {
  const validPrefix = "https://tagpro.koalabeast.com/";
  if (input.startsWith(validPrefix)) {
    if (input.includes("replay=")) return "replay";
    if (input.includes("uuid=")) return "uuid";
  }
  const uuidRegex = /^[0-9a-f-]{36}$/i;
  if (uuidRegex.test(input)) return "uuid";
  return "json";
}

function normalizeReplayUrl(url) {
  if (url.includes("game?replay=")) {
    const id = url.split("replay=")[1];
    return `https://tagpro.koalabeast.com/replays/gameFile?key=${id}`;
  }
  return url;
}

async function parseReplayInput(arg) {
  const type = validateInput(arg);
  if (type === "replay") {
    const normalized = normalizeReplayUrl(arg);
    return await parseReplayFromReplayLink(normalized);
  } else if (type === "uuid") {
    return await parseReplayFromUUID(arg);
  } else {
    return JSON.parse(arg);
  }
}


// Upload helper
async function uploadRecord(record, message) {
  try {
    const res = await fetch(`${WORKER_URL}?password=${PASSWORD}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });

    if (res.status === 201) {
      await message.react("✅");
      await message.reply(`✅ Record ${record.uuid} uploaded successfully!`);
    } else if (res.status === 409) {
      await message.react("⚠️");
      await message.reply(`⚠️ Duplicate record ${record.uuid}, skipped.`);
    } else if (res.status === 401) {
      await message.react("❌");
      await message.reply("🔒 Unauthorized: check your password.");
    } else {
      const text = await res.text();
      await message.react("❌");
      await message.reply(`❌ Error uploading record: ${res.status} ${text}`);
    }
  } catch (err) {
    await message.react("❌");
    await message.reply(`❌ Failed to upload: ${err.message}`);
  }
}

// Startup catch-up
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    // Find the most recent message the bot reacted to
    const recentMessages = await channel.messages.fetch({ limit: 100 });
    let lastProcessedId = null;
    for (const msg of recentMessages.values()) {
      const reacted = msg.reactions.cache.some((r) =>
        r.users.cache.has(client.user.id)
      );
      if (reacted) {
        lastProcessedId = msg.id;
        break;
      }
    }

    // Fetch only messages after that ID
    const fetchOptions = { limit: 50 };
    if (lastProcessedId) {
      fetchOptions.after = lastProcessedId;
    }
    const messages = await channel.messages.fetch(fetchOptions);

    let processed = 0,
      inserted = 0,
      duplicates = 0,
      invalid = 0,
      errors = 0;

    for (const msg of messages.values()) {
      if (msg.author.bot) continue;
      if (!msg.content.startsWith("!upload")) continue;

      const arg = msg.content.replace("!upload", "").trim();
      let record;
      try {
        record = await parseReplayInput(arg);
      } catch (err) {
        await msg.react("❌");
        invalid++;
        processed++;
        continue;
      }

      if (!record) {
        await msg.react("❌");
        invalid++;
        processed++;
        continue;
      }

      try {
        const res = await fetch(`${WORKER_URL}?password=${PASSWORD}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });

        if (res.status === 201) {
          await msg.react("✅");
          inserted++;
        } else if (res.status === 409) {
          await msg.react("⚠️");
          duplicates++;
        } else {
          await msg.react("❌");
          errors++;
        }
      } catch {
        await msg.react("❌");
        errors++;
      }

      processed++;
    }

    if (processed > 0) {
      await channel.send(
        `📦 **Catch-up complete!**\nProcessed: ${processed}\n✅ Inserted: ${inserted}\n⚠️ Duplicates: ${duplicates}\n❌ Invalid: ${invalid}\n❌ Errors: ${errors}`
      );
    }
  } catch (err) {
    console.error("❌ Failed to fetch channel messages:", err);
  }
});

// Real-time handler
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!upload")) return;

  const arg = message.content.replace("!upload", "").trim();
  let record;
  try {
    record = await parseReplayInput(arg);
  } catch (err) {
    await message.react("❌");
    await message.reply(`❌ Failed to parse replay: ${err.message}`);
    return;
  }

  if (!record) {
    await message.react("❌");
    await message.reply("❌ Could not extract record details.");
    return;
  }

  await uploadRecord(record, message);
});

client.login(DISCORD_TOKEN);
