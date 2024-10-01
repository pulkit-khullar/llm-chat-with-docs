import { Request, Response } from 'express';
import { Document } from "@langchain/core/documents";
import { Runnable, RunnableSequence, RunnableMap, RunnableBranch, RunnableLambda } from "@langchain/core/runnables";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate, ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { Chroma } from "@langchain/community/vectorstores/chroma";

const RESPONSE_TEMPLATE = `You are an expert programmer and problem-solver, tasked to answer any question about Mettalex.
Using the provided context, answer the user's question to the best of your ability using the resources provided.
Generate a comprehensive and informative answer (but no more than 80 words) for a given question based solely on the provided search results (URL and content).
You must only use information from the provided search results.
Use an unbiased and journalistic tone.
Combine search results together into a coherent answer.
Do not repeat text.
Cite search results using [\${{number}}] notation.
Only cite the most relevant results that answer the question accurately.
Place these citations at the end of the sentence or paragraph that reference them - do not put them all at the end.
If different results refer to different entities within the same name, write separate answers for each entity.
If there is nothing in the context relevant to the question at hand, just say "Hmm, I'm not sure." Don't try to make up an answer.

You should use bullet points in your answer for readability
Put citations where they apply rather than putting them all at the end.

Anything between the following \`context\`  html blocks is retrieved from a knowledge bank, not part of the conversation with the user.

<context>
{context}
<context/>

REMEMBER: If there is no relevant information within the context, just say "Hmm, I'm not sure." Don't try to make up an answer.
Anything between the preceding 'context' html blocks is retrieved from a knowledge bank, not part of the conversation with the user.`;

const REPHRASE_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone Question:`;

type RetrievalChainInput = {
    chat_history: string;
    question: string;
};

const getRetriever = async () => {
    const embeddings = new OpenAIEmbeddings({
        modelName: "text-embedding-3-small",
    });

    const vectorstore = new Chroma(embeddings, {
        collectionName: "Mettalex_agent_docs",
        url: "http://localhost:8000",
        collectionMetadata: {
            source: "source",
            title: "title",
        },
    });

    return vectorstore.asRetriever({ k: 6 });
};

const createRetrieverChain = (llm: BaseChatModel, retriever: Runnable) => {
    const CONDENSE_QUESTION_PROMPT = PromptTemplate.fromTemplate(REPHRASE_TEMPLATE);
    const condenseQuestionChain = RunnableSequence.from([
        CONDENSE_QUESTION_PROMPT,
        llm,
        new StringOutputParser(),
    ]).withConfig({
        runName: "CondenseQuestion",
    });

    const hasHistoryCheckFn = RunnableLambda.from(
        (input: RetrievalChainInput) => input.chat_history.length > 0,
    ).withConfig({ runName: "HasChatHistoryCheck" });

    const conversationChain = condenseQuestionChain.pipe(retriever).withConfig({
        runName: "RetrievalChainWithHistory",
    });

    const basicRetrievalChain = RunnableLambda.from(
        (input: RetrievalChainInput) => input.question,
    )
        .withConfig({ runName: "Itemgetter:question" })
        .pipe(retriever)
        .withConfig({ runName: "RetrievalChainWithNoHistory" });

    return RunnableBranch.from([
        [hasHistoryCheckFn, conversationChain],
        basicRetrievalChain,
    ]).withConfig({ runName: "FindDocs" });
};

const formatDocs = (docs: Document[]) => {
    return docs
        .map((doc, i) => `<doc id='${i}'>${doc.pageContent}</doc>`)
        .join("\n");
};

const formatChatHistoryAsString = (history: BaseMessage[]) => {
    return history
        .map((message) => `${message._getType()}: ${message.content}`)
        .join("\n");
};

const serializeHistory = (input: any) => {
    const chatHistory = input.chat_history || [];
    const convertedChatHistory = [];
    for (const message of chatHistory) {
        if (message.human !== undefined) {
            convertedChatHistory.push(new HumanMessage({ content: message.human }));
        }
        if (message["ai"] !== undefined) {
            convertedChatHistory.push(new AIMessage({ content: message.ai }));
        }
    }
    return convertedChatHistory;
};

const createChain = (llm: BaseChatModel, retriever: Runnable) => {
    const retrieverChain = createRetrieverChain(llm, retriever);
    const context = RunnableMap.from({
        context: RunnableSequence.from([
            ({ question, chat_history }) => ({
                question,
                chat_history: formatChatHistoryAsString(chat_history),
            }),
            retrieverChain,
            RunnableLambda.from(formatDocs).withConfig({ runName: "FormatDocumentChunks" }),
        ]),
        question: RunnableLambda.from((input: RetrievalChainInput) => input.question).withConfig({ runName: "Itemgetter:question" }),
        chat_history: RunnableLambda.from((input: RetrievalChainInput) => input.chat_history).withConfig({ runName: "Itemgetter:chat_history" }),
    }).withConfig({ tags: ["RetrieveDocs"] });

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", RESPONSE_TEMPLATE],
        new MessagesPlaceholder("chat_history"),
        ["human", "{question}"],
    ]);

    const responseSynthesizerChain = RunnableSequence.from([prompt, llm, new StringOutputParser()]).withConfig({
        tags: ["GenerateResponse"],
    });

    return RunnableSequence.from([
        {
            question: RunnableLambda.from((input: RetrievalChainInput) => input.question).withConfig({ runName: "Itemgetter:question" }),
            chat_history: RunnableLambda.from(serializeHistory).withConfig({ runName: "SerializeHistory" }),
        },
        context,
        responseSynthesizerChain,
    ]);
};

export const stream_log = async (req: Request, res: Response) => {
    try {
        const { input, config } = req.body;

        let llm;
        if (config.configurable.llm === "openai_gpt_3_5_turbo") {
            llm = new ChatOpenAI({
                modelName: "gpt-3.5-turbo-1106",
                temperature: 0,
            });
        } else {
            throw new Error("Invalid LLM option passed. Must be 'openai'. Received: " + config.llm);
        }

        const retriever = await getRetriever();
        const answerChain = createChain(llm, retriever);

        const stream = answerChain.streamLog(input, config, { includeNames: req.body.includeNames });

        const textEncoder = new TextEncoder();
        res.setHeader("Content-Type", "text/event-stream");

        for await (const chunk of stream) {
            res.write(`event: data\ndata: ${JSON.stringify(chunk)}\n\n`);
        }

        res.write("event: end\n\n");
        res.end();
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
}