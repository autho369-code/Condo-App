#!/usr/bin/env node
/**
 * Create a Vapi voice agent with receptionist flow.
 * Env: VAPI_API_KEY
 * Usage: node create-agent.mjs --name "Client Name" --webhook-url "https://..."
 */

const VAPI_KEY = process.env.VAPI_API_KEY;
const VAPI_API = "https://api.vapi.ai";

if (!VAPI_KEY) {
  console.error("Set VAPI_API_KEY");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${VAPI_KEY}`,
  "Content-Type": "application/json",
};

const RECEPTIONIST_PROMPT = `You are a professional receptionist for a property management company called {COMPANY_NAME}. 

Your role:
1. Answer calls warmly: "Thank you for calling {COMPANY_NAME}, this is AI receptionist. How can I help you today?"
2. Route calls based on intent:
   - Maintenance/issues → "I'll connect you with our maintenance team. Can I get your name and unit number?"
   - Billing/payments → "Let me transfer you to billing. What's your account number?"
   - New client/sales → "Great! Let me schedule a call with our team. What day works best?"
   - General questions → Answer from knowledge base or offer to take a message
3. If caller wants to speak to a human, collect name, number, and reason, then say "Someone will call you back within 2 hours."
4. Always be warm, professional, and concise.`;

async function main() {
  const nameIdx = process.argv.indexOf("--name");
  const name = nameIdx >= 0 ? process.argv[nameIdx + 1] : "Property Management";
  const prompt = RECEPTIONIST_PROMPT.replace(/{COMPANY_NAME}/g, name);

  const res = await fetch(`${VAPI_API}/assistant`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `${name} Receptionist`,
      model: {
        provider: "openai",
        model: "gpt-4o-mini-realtime-preview",
        messages: [{ role: "system", content: prompt }],
      },
      voice: { provider: "11labs", voiceId: "sarah" },
      firstMessage: `Thank you for calling ${name}. How can I help you today?`,
      endCallMessage: "Thank you for calling. Goodbye!",
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 600,
      transcriber: { provider: "deepgram", language: "en" },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Vapi ${res.status}: ${JSON.stringify(data)}`);

  console.log(JSON.stringify({
    id: data.id,
    name: data.name,
    status: "created",
    vapiUrl: `https://api.vapi.ai/assistant/${data.id}`,
  }, null, 2));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
