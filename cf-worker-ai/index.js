
import { Ai } from '@cloudflare/ai'
import { Hono } from "hono"
const app = new Hono()

app.get('/', async (c) => {
    const ai = new Ai(c.env.AI);
    const question = c.req.query('text') || "What is the square root of 9?"
    const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: question })
    const vectors = embeddings.data[0]
    const SIMILARITY_CUTOFF = 0.75
    const vectorQuery = await c.env.VECTOR_INDEX.query(vectors, { topK: 1 });
    const vecIds = vectorQuery.matches
        .filter(vec => vec.score > SIMILARITY_CUTOFF)
        .map(vec => vec.vectorId)

    let notes = []
    if (vecIds.length) {
        const query = `SELECT * FROM notes WHERE id IN (${vecIds.join(", ")})`
        const { results } = await c.env.DB.prepare(query).bind().all()
        if (results) notes = results.map(vec => vec.text)
    }

    const contextMessage = notes.length
        ? `Context:\n${notes.map(note => `- ${note}`).join("\n")}`
        : ""

    if (!notes.length) {
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

app.post('notes', async (c) => {
    const ai = new Ai(c.env.AI)
    const { text } = await c.req.json()

    if (!text) {
        return c.text("Missing text", 400)
    }

    const { results } = await c.env.DB.prepare("INSERT INTO notes (text) VALUES (?) RETURNING *").bind(text).run()
    const record = results.length ? results[0] : null

    if (!record) {
        return c.text("Failed to create note", 500)
    }

    const { data } = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [text] })
    const values = data[0]

    if (!values) {
        return c.text("Failed to generate vector embedding", 500);
    }

    const { id } = record
    const inserted = await c.env.VECTOR_INDEX.upsert([
    {
        id: id.toString(),
        values
    }])

    return c.json({ id, text, inserted })
})

app.onError((err, c) => {
    return c.text(err)
})

export default app
