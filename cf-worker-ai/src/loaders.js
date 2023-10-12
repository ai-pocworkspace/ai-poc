
import { CheerioWebBaseLoader } from 'langchain/document_loaders/web/cheerio'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { HtmlToTextTransformer } from 'langchain/document_transformers/html_to_text'

async function urlLoader(url) {
    const loader = new CheerioWebBaseLoader(url)
    // const docs = await loader.loadAndSplit()
    // return docs

    const document = await loader.load()
    const transformer = new HtmlToTextTransformer()
    const transformedDocument = await transformer.invoke(document)
    const splitter = RecursiveCharacterTextSplitter.fromLanguage("html")
    const documents = await splitter.invoke(transformedDocument)

    return documents
}

export { urlLoader }