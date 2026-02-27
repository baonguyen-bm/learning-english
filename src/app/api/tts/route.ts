import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const VOICE_MAP: Record<string, string> = {
  default: "en-US-AriaNeural",
  male: "en-US-GuyNeural",
  female: "en-US-AriaNeural",
  male2: "en-US-ChristopherNeural",
  female2: "en-US-JennyNeural",
};

export async function POST(request: NextRequest) {
  try {
    const { text, rate = 1.0, voice = "default" } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: "Text too long (max 2000 chars)" },
        { status: 400 }
      );
    }

    const voiceName = VOICE_MAP[voice] || VOICE_MAP.default;

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text, {
      rate: String(rate),
      pitch: "+0Hz",
      volume: "+0%",
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
