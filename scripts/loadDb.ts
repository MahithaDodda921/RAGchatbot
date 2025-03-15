import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { SimilarityMetric } from "@langchain/community/vectorstores/rockset";
import { launch } from "puppeteer";

type MySimilarityMetric = "cosine" | "euclidean" | "dot_product" | undefined;

import * as dotenv from 'dotenv';
dotenv.config();

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENAI_API_KEY,
} = process.env;

const apiEndpoint = process.env.ASTRA_DB_API_ENDPOINT;
const namespace = process.env.ASTRA_DB_NAMESPACE;
const collectionName = process.env.ASTRA_DB_COLLECTION;

if (!apiEndpoint || !namespace || !collectionName) {
  throw new Error("Missing required environment variables");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const newsData = [
  'https://www.nbcnews.com/',
  'https://apnews.com/',
  'https://www.cnn.com/',
  'https://news.google.com/home?hl=en-US&gl=US&ceid=US:en',
  'https://www.nytimes.com/',
  'https://www.foxnews.com/',
  'https://www.bbc.com/news',
  'https://www.reuters.com/',
  'https://www.usatoday.com/',
  'https://www.washingtonpost.com/',
  'https://www.buzzfeednews.com/',
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(apiEndpoint, { namespace });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (similarityMetric: MySimilarityMetric = "dot_product") => {
  const res = await db.createCollection(collectionName, {
    vector: {
      dimension: 1536,
      metric: similarityMetric
    },
  });
  console.log(res);
};

const loadSampleData = async () => {
  const collection = await db.collection(collectionName);
  for (const url of newsData) {
    const content = await scrapePage(url);
    const chunks = await splitter.splitText(content);
    for (const chunk of chunks) {
      try {
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk,
          encoding_format: "float",
        });
        const vector = embedding.data[0].embedding;
        const res = await collection.insertOne({
          $vector: vector,
          text: chunk,
        });
        console.log(res);
      } catch (error) {
        console.error("Error inserting data:", error);
      }
    }
  }
};

const scrapePage = async (url: string) => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: true, // You can set this to false for debugging
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });
  const scrapedData = await loader.scrape();
  return scrapedData?.replace(/<[^>]*>?/gm, "");
};

createCollection().then(() => loadSampleData());
