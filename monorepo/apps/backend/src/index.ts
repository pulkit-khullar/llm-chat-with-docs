import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import  { stream_log } from './chat/stream_log';
import { patchFeedback, postFeedback } from './feedback/feedback';
import { postPollForRun } from './trace/get_trace';
import { ingestDocs } from './ingestion/ingest';

const app = express();
app.use(express.json()); // Middleware to parse JSON
app.use(cors())

const router = express.Router();

router.post("/chat/stream_log", stream_log);
router.post("/feedback", postFeedback);
router.patch("/feedback", patchFeedback);
router.post("/get_trace", postPollForRun);
router.post("/ingest", ingestDocs)
router.get("/health", async (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK"
  })
})

// Mount API routes
app.use('/api', router);

const port = 3001;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
