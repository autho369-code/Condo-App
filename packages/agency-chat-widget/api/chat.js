/**
 * Example backend handler for the AI chat widget.
 * 
 * Deploy this as an API endpoint (Vercel serverless, Express, Supabase Edge Function, etc.)
 * Connect to your AI backend (OpenAI, Claude, Hermes) for intelligent responses.
 * 
 * The widget sends: { message: string, history: Array<{text, role}> }
 * The widget expects: { reply: string }
 */

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const { message, history } = await req.json();
  if (!message?.trim()) {
    return new Response(JSON.stringify({ reply: "I didn't catch that. Could you repeat?" }));
  }

  // ─── Lead qualification ────────────────────────────────────────
  // Detect if this looks like a business inquiry
  const bizKeywords = /price|cost|quote|service|hire|project|website|marketing|seo|automation|build|develop/i;
  const isBizInquiry = bizKeywords.test(message);

  // ─── Connect to your AI backend here ───────────────────────────
  // Replace this with a call to OpenAI / Claude / Hermes:
  // const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", { ... });
  
  let reply;
  if (isBizInquiry) {
    reply = `Thanks for your interest! 🎯 I'd love to learn more about your project. Could you share:\n\n1. What kind of project are you working on?\n2. What's your timeline?\n3. What's your budget range?\n\nOr I can connect you directly with our team — just let me know!`;
  } else {
    reply = `Thanks for reaching out! 😊 How can I help you today? We specialize in web development, AI automation, and growth marketing.`;
  }

  // Log the lead
  console.log(`[Lead] ${new Date().toISOString()} | Query: "${message.slice(0, 100)}" | Biz: ${isBizInquiry}`);

  return new Response(JSON.stringify({ reply }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export const config = { runtime: "edge" };
