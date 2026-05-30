#!/usr/bin/env node
/**
 * Provision Twilio phone number + SIP trunk.
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 * Usage: node provision-number.mjs --area-code 415
 */

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!SID || !TOKEN) {
  console.error("Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN");
  process.exit(1);
}

const API = `https://api.twilio.com/2010-04-01/Accounts/${SID}`;
const auth = "Basic " + Buffer.from(SID + ":" + TOKEN).toString("base64");
const headers = { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" };

async function post(path, body) {
  const res = await fetch(API + path, { method: "POST", headers, body: new URLSearchParams(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function main() {
  const areaIdx = process.argv.indexOf("--area-code");
  const areaCode = areaIdx >= 0 ? process.argv[areaIdx + 1] : "415";

  // Search available numbers
  const search = await fetch(`${API}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&VoiceEnabled=true&Limit=1`, { headers: { Authorization: auth } });
  const { available_phone_numbers } = await search.json();
  const num = available_phone_numbers?.[0];
  if (!num) throw new Error(`No numbers in area code ${areaCode}`);

  // Purchase
  const bought = await post("/IncomingPhoneNumbers.json", {
    PhoneNumber: num.phone_number,
    VoiceUrl: "",
    VoiceMethod: "POST",
  });

  const result = {
    sid: bought.sid,
    number: bought.phone_number,
    friendlyName: bought.friendly_name,
    areaCode,
    status: "provisioned",
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
