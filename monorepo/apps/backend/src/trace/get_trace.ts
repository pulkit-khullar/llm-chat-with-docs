import { Request, Response } from 'express';
import { Client } from 'langsmith';

const client = new Client();

const pollForRun = async (runId: string, retryCount = 0): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, retryCount * retryCount * 100));

  try {
    await client.readRun(runId);
  } catch (e) {
    return pollForRun(runId, retryCount + 1);
  }

  try {
    const sharedLink = await client.readRunSharedLink(runId);
    if (!sharedLink) {
      throw new Error("Run is not shared.");
    }
    return sharedLink;
  } catch (e) {
    return client.shareRun(runId);
  }
};

export const postPollForRun = async (req: Request, res: Response) => {
  try {
    const { run_id } = req.body;
    
    if (!run_id) {
      res.status(400).json({ error: "No run ID provided" });
      return
    }

    const response = await pollForRun(run_id);
    res.status(200).json(response);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
