import { DataAPIClient } from "@datastax/astra-db-ts";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as dotenv from "dotenv";
import Parser from "rss-parser";

const parser = new Parser();

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

const newsFeeds = [
  "https://feeds.arstechnica.com/arstechnica/index/",
  "https://www.theverge.com/rss/index.xml",
  "https://feeds.bbci.co.uk/news/rss.xml",
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

// Debugging: Log environment variables and validate them
console.log("Environment Variables:");
console.log("ASTRA_DB_API_ENDPOINT:", ASTRA_DB_API_ENDPOINT);
console.log("ASTRA_DB_NAMESPACE:", ASTRA_DB_NAMESPACE);
console.log("ASTRA_DB_COLLECTION:", ASTRA_DB_COLLECTION);
console.log("OPENAI_API_KEY:", OPENAI_API_KEY ? "Set" : "Not Set");

const createCollection = async () => {
  console.log("Creating collection...");
  const res = await db.createCollection(ASTRA_DB_COLLECTION, {
    vector: { dimension: 1536, metric: "dot_product" },
  });
  console.log("Collection created:", res);
};

const fetchRSSData = async (url: string) => {
  try {
    console.log(`Fetching data from: ${url}`);
    const feed = await parser.parseURL(url);
    console.log(`Successfully fetched data from ${url}`, feed);
    return feed.items.map((item) => ({
      title: item.title,
      link: item.link,
      content: item.contentSnippet || item.content || "",
      date: item.pubDate,
    }));
  } catch (error) { 
    console.error("Error fetching RSS from", url, error);
    return [];
  }
};

const loadSampleData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION);

  for (const feedUrl of newsFeeds) {
    console.log(`Processing feed: ${feedUrl}`);
    const articles = await fetchRSSData(feedUrl);

    if (articles.length === 0) {
      console.log(`No articles found for ${feedUrl}`);
      continue; // Skip if no articles
    }

    for (const article of articles) {
      console.log(`Processing article: ${article.title}`);

      const chunks = await splitter.splitText(article.content);
      console.log(`Article split into ${chunks.length} chunks`);

      for (const chunk of chunks) {
        try {
          console.log(`Creating embedding for chunk: ${chunk.substring(0, 50)}...`); // Display first 50 characters for debugging

          const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: chunk,
            encoding_format: "float",
          });

          const vector = embedding.data[0].embedding;
          console.log("Embedding created:", vector);

          const res = await collection.insertOne({
            $vector: vector,
            title: article.title,
            link: article.link,
            text: chunk,
          });

          console.log("Inserted into DB:", res);
        } catch (error) {
          console.error("Error inserting data for article:", article.title, error);
        }
      }
    }
  }
};

createCollection().then(() => {
  console.log("Starting data load...");
  loadSampleData();
});
