import axios from "axios";
import { ENV } from "./env";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMResponse {
  choices: Array<{ message: { content: string } }>;
}

export async function invokeLLM(params: { messages: Message[]; maxTokens?: number }): Promise<LLMResponse> {
  const res = await axios.post<LLMResponse>(
    `${ENV.forgeApiUrl}/v1/chat/completions`,
    {
      model: "gpt-4o-mini",
      messages: params.messages,
      max_tokens: params.maxTokens ?? 500,
    },
    {
      headers: {
        Authorization: `Bearer ${ENV.forgeApiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );
  return res.data;
}

export async function classifyTicket(title: string, description: string): Promise<string> {
  try {
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "You are a condominium property management assistant. Classify the ticket into one of: common_area, unit_related, emergency, vendor, board_matter, maintenance, other. Reply with only the category name." },
        { role: "user", content: `Title: ${title}\nDescription: ${description}` },
      ],
      maxTokens: 20,
    });
    return res.choices[0]?.message.content.trim().toLowerCase() ?? "other";
  } catch {
    return "other";
  }
}

export async function draftEmailReply(subject: string, body: string): Promise<string> {
  try {
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "You are a professional condominium property manager. Draft a concise, professional reply to this email. Keep it under 150 words." },
        { role: "user", content: `Subject: ${subject}\n\n${body}` },
      ],
      maxTokens: 300,
    });
    return res.choices[0]?.message.content.trim() ?? "";
  } catch {
    return "";
  }
}

export async function summarizeMeeting(agenda: string, minutes: string): Promise<string> {
  try {
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "You are a board meeting secretary for a condominium association. Summarize the meeting and extract key action items. Format as: Summary paragraph, then Action Items as a numbered list." },
        { role: "user", content: `Agenda:\n${agenda}\n\nMinutes:\n${minutes}` },
      ],
      maxTokens: 400,
    });
    return res.choices[0]?.message.content.trim() ?? "";
  } catch {
    return "";
  }
}
