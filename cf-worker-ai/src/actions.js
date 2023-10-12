
export async function createEmbedding(c, text, source, channel, ts) {
    const query = 'INSERT INTO documents (text, source, channel, ts, embedded) VALUES (?, ?, ?, ?, ?) RETURNING *'
    const { results } = await c.env.DB.prepare(query).bind(text, source, channel, ts).run()
    const record = results.length ? results[0] : null

    if (!record) {
        throw 'Failed to create document'
    }

    const embedding = await new Ai(c.env.AI).run('@cf/baai/bge-base-en-v1.5', { text: [text] })
    const values = embedding.data[0]

    if (!values) {
        throw 'Failed to generate vector embedding'
    }

    const inserted = await c.env.VECTOR_INDEX.upsert([{ id: record.id.toString(), values }])

    return inserted
}

export async function deleteEmbeddingByTs(c, channel, ts) {
    const record = await c.env.DB.prepare('SELECT * FROM documents WHERE channel = ? AND ts = ?').bind(channel, ts).first()

    if (!record) {
        throw 'Failed to locate embedding'
    }

    await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(record.id).run()
    await c.env.VECTOR_INDEX.deleteByIds([record.id])
    return true
}

export async function answerQuestion(c, question) {
    const embedding = await new Ai(c.env.AI).run('@cf/baai/bge-base-en-v1.5', { text: question })
    const values = embedding.data[0]
    const vectorQuery = await c.env.VECTOR_INDEX.query(values, { topK: 20 })
    const vectorMatches = vectorQuery.matches;
    const SIMILARITY_CUTOFF = 0.5
    const vectorIds = vectorMatches
        .filter(vector => vector.score > SIMILARITY_CUTOFF)
        .map(vector => vector.vectorId)

    let documents = []
    if (vectorIds.length) {
        const { results } = await c.env.DB.prepare(`SELECT * FROM documents WHERE id IN (${vectorIds.join(', ')})`).bind().all()
        if (results) documents = results.map(result => result.text)
    }

    if (!documents.length) {
        let vectorMessage = vectorMatches.length
            ? `${vectorMatches.length} vectors found with scores ${vectorMatches.map(vector => vector.score).join(', ')}.`
            : '0 vectors found.'

        return c.json({
            answer: `We don\'t seem to have any information about that in our systems. ${vectorMessage}`,
            context: '',
            vectorMatches
        })
    }

    const context = documents.length
        ? `Context:\n${documents.map(text => `- ${text}`).join('\n')}`
        : ''

    const { response: answer } = await ai.run(
        '@cf/meta/llama-2-7b-chat-int8',
        {
            messages: [
                { role: 'system', content: 'Be as short with your answer as possible.' },
                { role: 'system', content: 'When answering the question use the context provided.' },
                { role: 'system', content: context },
                { role: 'user', content: question }
            ]
        }
    )

    return { answer, context, vectorMatches }
}