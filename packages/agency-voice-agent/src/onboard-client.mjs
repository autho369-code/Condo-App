#!/usr/bin/env node
/**
 * Client Onboarding Pipeline — spins up a complete voice receptionist.
 * Provisions number → creates Vapi agent → connects them → returns live phone number.
 * 
 * Usage: node onboard-client.mjs --name "Client Name" --area-code 415
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, VAPI_API_KEY
 */

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function step(label, cmd) {
  console.error(`\n${label}...`);
  try {
    const result = JSON.parse(execSync(cmd, { cwd: __dirname, encoding: "utf-8" }).trim());
    return result;
  } catch (err) {
    throw new Error(`${label} failed: ${err.message}`);
  }
}

async function main() {
  const nameIdx = process.argv.indexOf("--name");
  const areaIdx = process.argv.indexOf("--area-code");
  const name = nameIdx >= 0 ? process.argv[nameIdx + 1] : "Client";
  const areaCode = areaIdx >= 0 ? process.argv[areaIdx + 1] : "415";

  console.error(`\n🎙️  Onboarding voice receptionist for: ${name}\n`);

  // Step 1: Provision phone number
  const number = await step(
    "1/3 Provisioning Twilio number",
    `node ${join(__dirname, "provision-number.mjs")} --area-code ${areaCode}`
  );
  console.error(`  ✅ ${number.number}`);

  // Step 2: Create Vapi agent
  const agent = await step(
    "2/3 Creating Vapi voice agent",
    `node ${join(__dirname, "create-agent.mjs")} --name "${name}"`
  );
  console.error(`  ✅ Agent ID: ${agent.id}`);

  // Step 3: Wire number to agent (update Twilio webhook)
  console.error("3/3 Connecting number to agent...");
  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const auth = "Basic " + Buffer.from(SID + ":" + TOKEN).toString("base64");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers/${number.sid}.json`,
    {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ VoiceUrl: `https://api.vapi.ai/call/twilio/inbound/${agent.id}` }),
    }
  );
  if (!res.ok) throw new Error(`Twilio webhook failed: ${await res.text()}`);
  console.error("  ✅ Connected");

  console.log(JSON.stringify({
    client: name,
    phoneNumber: number.number,
    twilioSid: number.sid,
    vapiAgentId: agent.id,
    status: "live",
    onboardedAt: new Date().toISOString(),
  }, null, 2));

  console.error("\n🎉 Receptionist is LIVE!\n");
}

main().catch((err) => {
  console.error("Onboarding failed:", err.message);
  process.exit(1);
});
