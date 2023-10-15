
import { Hono } from 'hono'
import {
    answerQuestion,
    createDocumentAndEmbedding,
    deleteDocumentAndEmbeddingByExternalId,
    stuffDocuments
} from './actions'
import { urlLoader } from './loaders'
import { ValidationError, useEnv } from './util'

const app = new Hono()

app.use('*', useEnv())

app.get('ask', async (c) => {
    const { question } = c.req.query()
    if (!question) throw new ValidationError
    const { answer, metadata, context, vectorMatches } = await answerQuestion(question)
    return c.json({ answer, metadata, context, vectorMatches })
})

app.post('embeddings', async (c) => {
    const { external_id, text, source, metadata } = await c.req.json()
    if (!external_id || !text) throw new ValidationError
    console.log('METADATA', metadata)
    const { document, embedding } = await createDocumentAndEmbedding(external_id, text, source || '', metadata || {})
    return c.json({ document, embedding })
})

app.delete('embeddings/:external_id', async (c) => {
    const { external_id } = c.req.param()
    if (!external_id) throw new ValidationError
    await deleteDocumentAndEmbeddingByExternalId(external_id)
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
            ? await stuffDocuments(documents, 'url') && `${documents.length} documents embedded`
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
