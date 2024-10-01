import { Request, Response } from 'express';
import { Client } from 'langsmith';

const client = new Client();

export const postFeedback = async (req: Request, res: Response) => {
    try {
        const { run_id, key = 'user_score', ...rest } = req.body;

        if (!run_id) {
            res.status(400).json({ error: "No LangSmith run ID provided" });
            return
        }

        await client.createFeedback(run_id, key, rest);

        res.status(200).json({ result: "posted feedback successfully" });
        return
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
        return
    }
}

export const patchFeedback = async (req: Request, res: Response) => {
    try {
        const { feedback_id, score, comment } = req.body;

        if (feedback_id === undefined) {
            res.status(400).json({ error: "No feedback ID provided" });
            return
        }

        await client.updateFeedback(feedback_id, { score, comment });

        res.status(200).json({ result: "patched feedback successfully" });
        return
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};
