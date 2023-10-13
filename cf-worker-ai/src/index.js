
import { Hono } from 'hono'
import {
    answerQuestion,
    createDocumentAndEmbedding,
    deleteDocumentAndEmbeddingByTs,
    stuffDocuments
} from './actions'
import { urlLoader } from './loaders'
import { ValidationError, useEnv } from './util'

const app = new Hono()

app.use('*', useEnv())

app.get('ask', async (c) => {
    const { question } = c.req.query()
    if (!question) throw new ValidationError
    const { answer, context, vectorMatches } = await answerQuestion(question)
    return c.json({ answer, context, vectorMatches })
})

app.post('embeddings', async (c) => {
    const { text, source, channel, ts } = await c.req.json()
    if (!text) throw new ValidationError
    const { document, embedding } = await createDocumentAndEmbedding(text, source || '', channel || '', ts || '')
    return c.json({ document, embedding })
})

app.delete('embeddings/:channel/:ts', async (c) => {
    const { channel, ts } = c.req.param()
    if (!channel || !ts) throw new ValidationError
    await deleteDocumentAndEmbeddingByTs(channel, ts)
    return c.json({})
})

app.get('loader', async (c) => {
    const { type, value } = c.req.query()
    if (!type || !value) throw new ValidationError

    let documents = []

    switch(type) {
        case 'url':
            documents = await urlLoader(value);
            break;
        default: throw new ValidationError(`type "${type}" not supported`);
    }

    return c.json({
        message: documents.length
            ? stuffDocuments(documents) && `${documents.length} documents embedded`
            : 'No documents were embedded.'
    })
})

app.onError((e, c) => {
    if (!e.code) console.log(e)

    return c.json({ error: e.message }, e.code || 500)
})

// app.post('transcribe', async (c) => {
//     const ai = new Ai(c.env.AI)
//     const { file_url } = await c.req.json()
//
//     if (!file_url) {
//         return c.json({ error: 'Missing file_url' }, 400)
//     }
//
//     console.log(file_url)
//
//     const file = await fetch(file_url)
//     const blob = await file.arrayBuffer()
//     const audio = [...new Uint8Array(blob)]
//
//     console.log(audio)
//
//     const response = await ai.run('@cf/openai/whisper', { audio })
//
//     return c.json({ response })
// })

export default app
