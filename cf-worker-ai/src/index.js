
import { Ai } from '@cloudflare/ai'
import { Hono } from "hono"
const app = new Hono()

app.get('ask', async (c) => {
    const ai = new Ai(c.env.AI);
    const question = c.req.query('question')
    const embedding = await ai.run('@cf/baai/bge-base-en-v1.5', { text: question })
    const vectors = embedding.data[0]
    const SIMILARITY_CUTOFF = 0.75
    const vectorQuery = await c.env.VECTOR_INDEX.query(vectors, { topK: 1 });
    const vecIds = vectorQuery.matches
        .filter(vec => vec.score > SIMILARITY_CUTOFF)
        .map(vec => vec.vectorId)

    let embeddings = []
    if (vecIds.length) {
        const query = `SELECT * FROM embeddings WHERE id IN (${vecIds.join(", ")})`
        const { results } = await c.env.DB.prepare(query).bind().all()
        if (results) embeddings = results.map(result => result.text)
    }

    const contextMessage = embeddings.length
        ? `Context:\n${embeddings.map(embedding => `- ${embedding}`).join("\n")}`
        : ""

    if (!embeddings.length) {
        return c.json({ answer: "We don't seem to have any information about that in our systems."})
    }

    const { response: answer } = await ai.run(
        '@cf/meta/llama-2-7b-chat-int8',
        {
            messages: [
                { role: 'system', content: "Be as short with your answer as possible." },
                { role: 'system', content: "When answering the question use the context provided." },
                { role: 'system', content: contextMessage },
                { role: 'user', content: question }
            ]
        }
    )

    return c.json({ answer, contextMessage });
})

app.post('embeddings', async (c) => {
    const ai = new Ai(c.env.AI)
    const { text, channel, ts } = await c.req.json()

    if (!text) {
        return c.text("Missing text", 400)
    }

    const { results } = await c.env.DB.prepare("INSERT INTO embeddings (text, channel, ts) VALUES (?, ?, ?) RETURNING *").bind(text, channel || "", ts || "").run()
    const record = results.length ? results[0] : null

    if (!record) {
        return c.text("Failed to create embedding", 500)
    }

    const { data } = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [text] })
    const values = data[0]

    if (!values) {
        return c.text("Failed to generate vector embedding", 500);
    }

    const { id } = record
    const inserted = await c.env.VECTOR_INDEX.upsert([{ id: id.toString(), values }])

    return c.json({ id, text, inserted })
})

app.delete('embeddings/:channel/:ts', async (c) => {
    const ai = new Ai(c.env.AI)
    const channel = c.req.param("channel")
    const ts = c.req.param("ts")

    if (!channel || !ts) {
        return c.text("Missing required params", 400)
    }

    const result = await c.env.DB.prepare("SELECT * FROM embeddings WHERE channel = ? AND ts = ?").bind(channel, ts).first()
    await c.env.DB.prepare("DELETE FROM embeddings WHERE id = ?").bind(result.id).run()
    await c.env.VECTOR_INDEX.deleteByIds([result.id])

    return c.json({})
})

app.onError((err, c) => {
    return c.json(err)
})

export default app
