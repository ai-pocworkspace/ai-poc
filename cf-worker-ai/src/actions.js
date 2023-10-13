
import { Ai } from '@cloudflare/ai'
import { ResourceNotFoundError, env } from './util'

// import { CloudflareVectorizeStore } from 'langchain/vectorstores/cloudflare_vectorize'
// import { CloudflareWorkersAIEmbeddings } from 'langchain/embeddings/cloudflare_workersai'

export async function createEmbedding(text) {
    const ai = new Ai(env().AI)
    const embedding = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [text] })
    return embedding
}

export async function insertVector(document, embedding) {
    const values = embedding.data[0]
    const { ids } = await env().VECTOR_INDEX.upsert([{ id: document.id.toString(), values }])
    return ids
}

export async function stuffDocuments(documents, source = null) {
    let ids = []

    for (let document of documents) {
        const { document: id } = await createDocumentAndEmbedding(document.pageContent, source)
        ids.push(id)
    }

    return ids.length > 0
}

export async function createDocumentAndEmbedding(text, source = null, channel = null, ts = null) {
    const query = 'INSERT INTO documents (text, source, channel, ts) VALUES (?, ?, ?, ?) RETURNING *'
    const { results } = await env().DB.prepare(query).bind(text, source, channel, ts).run()
    const document = results.length ? results[0] : null

    if (!document) {
        throw 'Failed to create document'
    }

    const embedding = await createEmbedding(text)

    if (!embedding) {
        throw 'Failed to generate vector embedding'
    }

    const ids = await insertVector(document, embedding)

    await env().DB.prepare(`UPDATE documents SET embedded = 1 WHERE id IN (${ids.join(', ')})`).run()

    return { document, embedding }
}

export async function deleteDocumentAndEmbeddingByTs(channel, ts) {
    const document = await env().DB.prepare('SELECT * FROM documents WHERE channel = ? AND ts = ?').bind(channel, ts).first()

    if (!document) {
        throw new ResourceNotFoundError('failed to locate embedding')
    }

    await env().DB.prepare('DELETE FROM documents WHERE id = ?').bind(document.id).run()
    await env().VECTOR_INDEX.deleteByIds([document.id])
    return true
}

export async function answerQuestion(question) {
    const embedding = await createEmbedding(question)
    const values = embedding.data[0]
    const vectorQuery = await env().VECTOR_INDEX.query(values, { topK: 20 })
    const vectorMatches = vectorQuery.matches
    const SIMILARITY_CUTOFF = 0.75
    const vectorIds = vectorMatches
        .filter(vector => vector.score > SIMILARITY_CUTOFF)
        .map(vector => vector.vectorId)

    let documents = []
    if (vectorIds.length) {
        const { results } = await env().DB.prepare(`SELECT * FROM documents WHERE id IN (${vectorIds.join(', ')})`).bind().all()
        if (results) documents = results.map(result => result.text)
    }

    if (!documents.length) {
        let vectorMessage = vectorMatches.length
            ? `${vectorMatches.length} vectors found with a score of ${Math.floor(vectorMatches.map(vector => vector.score).shift() * 100)}% or lower. The cutoff is ${SIMILARITY_CUTOFF * 100}%.`
            : '0 vectors found.'

        const answer = `We don\'t seem to have any information about that in our knowledgebase. ${vectorMessage}`
        const context = ''

        return { answer, context, vectorMatches }
    }

    const context = `Context:\n${documents.map(text => `- ${text}`).join('\n')}`

    const ai = new Ai(env().AI)
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