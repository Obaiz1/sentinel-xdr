import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are the Sentinel AI Assistant — an expert cybersecurity analyst embedded in the Sentinel LLM-Powered Intrusion Detection System (IDS).

Your ONLY purpose is to answer questions about:
- Network security and intrusion detection
- The current IDS alerts and logs provided as context
- Cybersecurity threats, attack vectors, and defense strategies  
- Network protocols, packet analysis, and anomaly detection
- Sentinel system status, performance metrics, and operations
- Best practices for SOC (Security Operations Center) analysis

If a user asks ANYTHING outside of cybersecurity and network security topics, you MUST respond with exactly:
"Query out of context. I am specialized only in Sentinel security data."

You are concise, precise, and professional. Format responses clearly. Use markdown for structure when helpful.`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

export async function POST(req: NextRequest) {
  try {
    const { message, context, history } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Prepare content
    let contextBlock = "";
    if (context && context.length > 0) {
      contextBlock =
        "\n\n[CURRENT IDS CONTEXT — Recent Alerts]\n" +
        context
          .slice(0, 5)
          .map(
            (a: any) =>
              `- [${a.threat_level || "INFO"}] ${a.attack_vector || "Unknown"}: ${a.src_ip} → ${a.dst_ip} — ${a.explanation || ""}`
          )
          .join("\n");
    }

    const userMessage = message + contextBlock;

    // ── Attempt 1: Gemini ───────────────────────────────────────────────────
    if (process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          systemInstruction: SYSTEM_PROMPT,
        });

        const rawHistory = (history ?? [])
          .slice(-6)
          .map((h: { role: string; content: string }) => ({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: h.content }],
          }));

        const firstUserIndex = rawHistory.findIndex((h: { role: string }) => h.role === "user");
        const validHistory = firstUserIndex !== -1 ? rawHistory.slice(firstUserIndex) : [];

        const chat = model.startChat({ history: validHistory });
        const result = await chat.sendMessage(userMessage);
        return NextResponse.json({ reply: result.response.text() });
      } catch (geminiErr) {
        console.error("[ChatRoute] Gemini Failed, attempting Groq fallback...", geminiErr);
      }
    }

    // ── Attempt 2: Groq Fallback ─────────────────────────────────────────────
    if (process.env.GROQ_API_KEY) {
      try {
        const groqHistory = (history ?? []).slice(-6).map((h: any) => ({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content,
        }));

        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...groqHistory,
            { role: "user", content: userMessage },
          ],
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          temperature: 0.2,
        });

        return NextResponse.json({
          reply: completion.choices[0]?.message?.content || "⚠️ Fallback failed.",
        });
      } catch (groqErr) {
        console.error("[ChatRoute] Groq Failed", groqErr);
      }
    }

    return NextResponse.json(
      { reply: "⚠️ All AI providers are currently unavailable. Please check your API keys." },
      { status: 200 }
    );
  } catch (err) {
    console.error("[ChatRoute] Global Error", err);
    return NextResponse.json(
      { reply: "⚠️ Critical error processing query. Please try again." },
      { status: 200 }
    );
  }
}
