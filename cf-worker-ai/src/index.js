
import { Hono } from 'hono'

import { createEmbedding, deleteEmbeddingByTs, answerQuestion } from './actions'

// import { CloudflareVectorizeStore } from 'langchain/vectorstores/cloudflare_vectorize'
// import { CloudflareWorkersAIEmbeddings } from 'langchain/embeddings/cloudflare_workersai'
// import { urlLoader } from './loaders'

const app = new Hono()

app.get('ask', async (c) => {
    const question = c.req.query('question')

    if (!question) {
        return c.json({ error: 'Validation Error: missing required params' }, 400)
    }

    const { answer, context, vectorMatches } = await answerQuestion(c, question)
    return c.json({ answer, context, vectorMatches })
})

app.post('embeddings', async (c) => {
    const { text, source, channel, ts } = await c.req.json()

    if (!text) {
        return c.json({ error: 'Validation Error: missing required params' }, 400)
    }

    const embedding = await createEmbedding(c, text, source || '', channel || '', ts || '')
    return c.json({ embedding })
})

app.delete('embeddings/:channel/:ts', async (c) => {
    const channel = c.req.param('channel')
    const ts = c.req.param('ts')

    if (!channel || !ts) {
        return c.json({ error: 'Validation Error: missing required params' }, 400)
    }

    await deleteEmbeddingByTs(c, channel, ts)
    return c.json({})
})

// app.post('transcribe', async (c) => {
//     const ai = new Ai(c.env.AI)
//     const { file_url } = await c.req.json()

//     if (!file_url) {
//         return c.json({ error: 'Missing file_url' }, 400)
//     }

//     console.log(file_url)

//     const file = await fetch(file_url)
//     const blob = await file.arrayBuffer()
//     const audio = [...new Uint8Array(blob)]

//     console.log(audio)

//     const response = await ai.run('@cf/openai/whisper', { audio })

//     return c.json({ response })
// })

// app.get('loader', async (c) => {
//     const type = c.req.query('type')
//     const value = c.req.query('value')

//     if (!type || !value) {
//         return c.json({ error: 'Missing type and value' }, 400)
//     }

//     if (type == 'url') {
//         let docs = await urlLoader(value)

//         if (docs.length) {
//             try {
//                 const stmt = c.env.DB.prepare('INSERT INTO embeddings (text, channel, ts) VALUES (?, ?, ?) RETURNING *')
//                 const stmts = docs.map(doc => stmt.bind(doc.pageContent, '', ''))
//                 const rows = await c.env.DB.batch(stmts)
//                 const ids = rows.map(row => row['results'][0].id)
//                 const embeddings = new CloudflareWorkersAIEmbeddings({ binding: c.env.AI, modelName: '@cf/baai/bge-base-en-v1.5', batchSize: 1 })
//                 const store = new CloudflareVectorizeStore(embeddings, { index: c.env.VECTOR_INDEX, maxConcurrency: 1 });
//                 const addedIds = await store.addDocuments(docs, { ids })
//                 console.log(`Added ids: ${addedIds.join(', ')}`)
//             } catch (e) {
//                 console.log(e)
//             }

//             return c.json({ message: `${docs.length} documents entered into the database` })
//         }

//         return c.json({ message: 'No documents were entered into the database.' })
//     }

//     return c.json({ error: `Type "${type}" not supported` }, 400)
// })

app.onError((e, c) => {
    console.log(e)
    return c.json({ error: e }, 500)
})

export default app
