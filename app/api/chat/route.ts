import OpenAI from "openai";
import { DataAPIClient } from "@datastax/astra-db-ts";
import * as dotenv from "dotenv";

dotenv.config(); 

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENAI_API_KEY,
} = process.env;

if (!ASTRA_DB_API_ENDPOINT || !ASTRA_DB_NAMESPACE || !ASTRA_DB_COLLECTION) {
  throw new Error("Missing required environment variables");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1]?.content;

    let docContext = "";

    // Generate embeddings for the query
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: latestMessage,
      encoding_format: "float",
    });

    try {
      const collection = await db.collection(ASTRA_DB_COLLECTION);
      const cursor = collection.find(null, {
        sort: {
          $vector: embedding.data[0].embedding,
        },
        limit: 10,
      });
      const documents = await cursor.toArray();
      const docsMap = documents?.map((doc) => doc.text);
      docContext = JSON.stringify(docsMap);
    } catch (err) {
      console.error("Error querying db...");
      docContext = "";
    }

    const template = {
      role: "system",
      content: `You are an AI assistant who knows everything about Latest Tech updates.
      Use the below context to augment what you know about technology updates.
      If the context doesn't include the information you need, answer based on your existing knowledge.
      Don't mention the source of your information or what the context does or doesn't include.
      Format responses using markdown where applicable and don't return images.

      ---------------
      START CONTEXT
      ${docContext}
      END CONTEXT
      ---------------
      QUESTION: ${latestMessage}
      ---------------`,
    };

    // ✅ Corrected Streaming API Implementation
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      stream: true,
      messages: [template, ...messages],
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || "";
          controller.enqueue(encoder.encode(content));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
