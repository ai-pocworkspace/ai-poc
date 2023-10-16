
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

export async function queueDocuments(documents, source = null) {
    const embeddings = documents.map(document => {
        return {
            body: {
                external_id: btoa(document.metadata.source),
                text: document.pageContent,
                source: source,
                metadata: document.metadata
            },
            contentType: "json"
        }
    })
    await env().EMBEDDINGS_QUEUE.sendBatch(embeddings)

    return documents.length
}

export async function createDocumentAndEmbedding(external_id, text, source = null, metadata = {}) {
    const query = 'INSERT INTO documents (external_id, text, source, metadata, embedded) VALUES (?, ?, ?, ?, ?) RETURNING *'
    const { results } = await env().DB.prepare(query).bind(external_id, text, source, JSON.stringify(metadata), 0).run()
    const document = results.length ? results[0] : null

    if (!document) {
        throw 'Failed to create document'
    }

    try {
        const embedding = await createEmbedding(text)

        if (!embedding) {
            throw 'Failed to generate vector embedding'
        }

        const ids = await insertVector(document, embedding)
        await env().DB.prepare(`UPDATE documents SET embedded = 1 WHERE id IN (${ids.join(', ')})`).run()

        return { document, embedding }
    } catch (e) {
        // ignore for now ...
        // await env().DB.prepare(`DELETE FROM documents WHERE id IN (${document.id})`).bind().run()
        // throw e
    }
}

export async function deleteDocumentAndEmbeddingByExternalId(external_id) {
    const { results } = await env().DB.prepare('SELECT * FROM documents WHERE external_id = ?').bind(external_id).all()

    if (!results.length) {
        throw new ResourceNotFoundError('failed to locate embedding')
    }

    const ids = results.map(result => result.id)
    await env().DB.prepare(`DELETE FROM documents WHERE id IN (${ids.join(', ')})`).bind().run()
    await env().VECTOR_INDEX.deleteByIds(ids)
    return true
}

export async function answerQuestion(question) {
    const embedding = await createEmbedding(question)
    const values = embedding.data[0]
    const vectorQuery = await env().VECTOR_INDEX.query(values, { topK: 20 })
    const vectorMatches = vectorQuery.matches
    const SIMILARITY_CUTOFF = 0.7
    const vectorIds = vectorMatches
        .filter(vector => vector.score > SIMILARITY_CUTOFF)
        .map(vector => vector.vectorId)

    let documents = []
    if (vectorIds.length) {
        const { results } = await env().DB.prepare(`SELECT * FROM documents WHERE id IN (${vectorIds.join(', ')})`).bind().all()
        if (results.length) documents = results
    }

    if (!documents.length) {
        let vectorMessage = vectorMatches.length
            ? `${vectorMatches.length} vectors found with a score of ${Math.floor(vectorMatches.map(vector => vector.score).shift() * 100)}% or lower. The cutoff is ${SIMILARITY_CUTOFF * 100}%.`
            : '0 vectors found.'

        const answer = `We don\'t seem to have any information about that in our knowledgebase. ${vectorMessage}`
        const metadata = {}
        const context = ''

        return { answer, metadata, context, vectorMatches }
    }

    const context = `Context:\n${documents.map(document => `- ${document.text}`).join('\n')}`

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

    const metadata = [...new Set(documents.map(document => {
        let metadata = JSON.parse(document?.metadata)

        if (document.source == 'url') {
            return { type: 'url', url: metadata.source }
        }

        if (document.source == 'slack') {
            return { type: 'slack', channel: metadata.channel, ts: metadata.ts }
        }

        return false
    }).filter(Boolean))]

    return { answer, metadata, context, vectorMatches }
}