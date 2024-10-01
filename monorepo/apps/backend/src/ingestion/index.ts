import { DocumentInterface } from "@langchain/core/documents";
// import { Chroma } from "@langchain/chroma"; // Import Chroma
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { BaseDocumentLoader } from "langchain/document_loaders/base";
import {
  _HashedDocument,
  _batch,
  _deduplicateInOrder,
  _getSourceIdAssigner,
} from "langchain/indexes";

const DEFAULTS = {
  batchSize: 100,
  cleanupBatchSize: 1000,
  forceUpdate: false,
};

export async function index(options: {
  docsSource: BaseDocumentLoader | Array<DocumentInterface>;
  vectorStore: Chroma; // Changed type to Chroma
  /**
   * @default 100
   */
  batchSize?: number;
  cleanup?: "incremental" | "full";
  sourceIdKey: string | ((doc: DocumentInterface) => string);
  /**
   * @default {1000}
   */
  cleanupBatchSize?: number;
  /**
   * @default false
   */
  forceUpdate?: boolean;
}): Promise<{
  numAdded: number;
  numSkipped: number;
  numDeleted: number;
}> {
  const {
    docsSource,
    vectorStore,
    batchSize,
    cleanup,
    sourceIdKey,
    cleanupBatchSize,
    forceUpdate,
  } = { ...DEFAULTS, ...options };

  if (cleanup === "incremental" && !sourceIdKey) {
    throw new Error(
      "Source id key is required when cleanup mode is incremental."
    );
  }

  let docs: Array<DocumentInterface>;
  if (!Array.isArray(docsSource)) {
    try {
      docs = await docsSource.load();
    } catch (e) {
      throw new Error(`Error loading documents from source: ${e}`);
    }
  } else {
    docs = docsSource;
  }

  const sourceIdAssigner = _getSourceIdAssigner(sourceIdKey);

  // Mark when the update started.
  // const indexStartDt = new Date().toISOString();
  const indexStartDt = Date.now();
  let numAdded = 0;
  let numSkipped = 0;
  let numDeleted = 0;

  for (const docBatch of _batch(batchSize, docs)) {
    const hashedDocs = _deduplicateInOrder(
      docBatch.map((doc) => _HashedDocument.fromDocument(doc))
    );

    let sourceIds = hashedDocs.map(sourceIdAssigner);

    if (cleanup === "incremental") {
      // Ensure source IDs are present
      for (let i = 0; i < sourceIds.length; i += 1) {
        const sourceId = sourceIds[i];
        if (sourceId === null) {
          throw new Error(
            `Source ids are required when cleanup mode is incremental.\nDocument that starts with content: ${hashedDocs[i].pageContent.substring(
              0,
              100
            )} was not assigned a source id.`
          );
        }
      }
    }

    const uids = hashedDocs.map(({ uid }) => uid);

    // Check for existing documents in ChromaDB using the collection's get method
    const existingDocs = await vectorStore.collection.get({ ids: uids });

    // Prepare documents to index
    const existingUids = new Set(existingDocs.ids);
    const docsToIndex: Array<DocumentInterface> = [];
    const uidsToRefresh: Array<string> = [];

    for (let i = 0; i < hashedDocs.length; i += 1) {
      const hashedDoc = hashedDocs[i];
      const uid = hashedDoc.uid;
      const docExists = existingUids.has(uid);
      if (docExists && !forceUpdate) {
        uidsToRefresh.push(uid);
        numSkipped += 1;
        continue;
      } else if (docExists && forceUpdate) {
        // Delete the existing document to update it
        await vectorStore.delete({ ids: [uid] });
        numDeleted += 1;
      }
      // Add timestamp and other metadata
      const metadata = {
        uid: hashedDoc.uid,
        sourceId: sourceIds[i],
        indexedAt: indexStartDt,
        ...hashedDoc.metadata,
      };
      docsToIndex.push({
        pageContent: hashedDoc.pageContent,
        metadata,
      });
    }

    // Add documents to ChromaDB
    if (docsToIndex.length) {
      await vectorStore.addDocuments(docsToIndex, {
        ids: docsToIndex.map((doc) => doc.metadata.uid),
      });
      numAdded += docsToIndex.length;
    }

    // Perform incremental cleanup if needed
    if (cleanup === "incremental") {
      // Retrieve documents with the same sourceId but older timestamps
      const oldDocs = await vectorStore.collection.get({
        where: {
          sourceId: sourceIds[0],
          indexedAt: { $lt: indexStartDt },
        },
      });

      const uidsToDelete = oldDocs.ids;

      if (uidsToDelete.length) {
        await vectorStore.delete({ ids: uidsToDelete });
        numDeleted += uidsToDelete.length;
      }
    }
  }

  if (cleanup === "full") {
    // Retrieve all documents indexed before indexStartDt
    let offset = 0;
    const limit = cleanupBatchSize;
    let hasMore = true;

    while (hasMore) {
      const oldDocs = await vectorStore.collection.get({
        where: {
          indexedAt: { $lt: indexStartDt },
        },
        limit,
        offset,
      });

      const uidsToDelete = oldDocs.ids;

      if (uidsToDelete.length) {
        await vectorStore.delete({ ids: uidsToDelete });
        numDeleted += uidsToDelete.length;
        offset += limit;
      } else {
        hasMore = false;
      }
    }
  }

  return {
    numAdded,
    numSkipped,
    numDeleted,
  };
}
