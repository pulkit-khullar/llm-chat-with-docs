import { Request, Response } from 'express';
import { DocumentInterface } from "@langchain/core/documents";
import { RecursiveUrlLoader } from "langchain/document_loaders/web/recursive_url";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Embeddings } from "@langchain/core/embeddings";
import { SitemapLoader } from "langchain/document_loaders/web/sitemap";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { index } from './index';
import { Chroma } from "@langchain/community/vectorstores/chroma";

// API Handler for ingesting documents
export const ingestDocs = async (req: Request, res: Response) => {
  try {
    // Load Mettalex documents
    const loadLangSmithDocs = async (): Promise<Array<DocumentInterface>> => {
      // const loader = new RecursiveUrlLoader("https://mettalex.com/", {
      //   maxDepth: 8,
      //   timeout: 600,
      // });

      const loader = new PuppeteerWebBaseLoader("https://mettalex.com/", {
      })
      return loader.load();
    };

    // Load LangChain docs via sitemap
    const loadLangChainDocs = async (): Promise<Array<DocumentInterface>> => {
      // const loader = new SitemapLoader("https://docs.mettalex.com/");

      const loader = new PuppeteerWebBaseLoader("https://docs.mettalex.com/", {
      })
      return loader.load();
    };

    // Get OpenAI embeddings
    const getEmbeddingsModel = (): Embeddings => {
      return new OpenAIEmbeddings({
        modelName: "text-embedding-3-small",
      });
    };

    // const smithDocs = await loadLangSmithDocs();
    // console.debug(`Loaded ${smithDocs.length} docs from LangSmith`);

    const langchainDocs = await loadLangChainDocs();
    console.debug(`Loaded ${langchainDocs.length} docs from documentation`);

    if (!langchainDocs.length) {
      res.status(500).json({ error: "No LangChain documents were loaded." });
      return
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkOverlap: 200,
      chunkSize: 4000,
    });

    const docsTransformed = await textSplitter.splitDocuments([
      // ...smithDocs,
      ...langchainDocs,
    ]);

    console.debug('docsTransformed')
    console.debug(docsTransformed)

    // Ensure 'source' and 'title' metadata are present
    for (const doc of docsTransformed) {
      console.debug("doc")
      console.debug(doc)
      doc.metadata.source = doc.metadata.source || "";
      doc.metadata.title = doc.metadata.title || "";
    }

    const embeddings = getEmbeddingsModel();

    // Initialize Chroma Vector Store
    const vectorStore = await Chroma.fromDocuments(docsTransformed, embeddings, {
      collectionName: "Mettalex_agent_docs",
      url: "http://localhost:8000", // Ensure ChromaDB is running at this URL
    });

    // Indexing process
    const indexingStats = await index({
      docsSource: docsTransformed,
      vectorStore,
      cleanup: "full",
      sourceIdKey: "source",
      forceUpdate: process.env.FORCE_UPDATE === "true",
    });

    console.log({ indexingStats }, "Indexing stats");

    // Fetch the total number of vectors from ChromaDB
    try {
      const numVecs = await vectorStore.collection.count();
      console.log(`ChromaDB now has this many vectors: ${numVecs}`);
    } catch (e) {
      console.error("Failed to fetch total vectors from ChromaDB.");
    }

    // Return success response with stats
    res.status(200).json({
      message: "Documents successfully ingested and indexed",
      indexingStats,
    });
    return

  } catch (e: any) {
    console.error("Failed to ingest docs", e);
    res.status(500).json({ error: e.message });
    return
  }
};
