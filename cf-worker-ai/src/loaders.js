
import { CheerioWebBaseLoader } from 'langchain/document_loaders/web/cheerio'
import { HtmlToTextTransformer } from 'langchain/document_transformers/html_to_text'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

async function urlLoader(url) {
    const document = await (new CheerioWebBaseLoader(url)).load()
    const transformedDocument = await (new HtmlToTextTransformer).invoke(document)
    return await RecursiveCharacterTextSplitter.fromLanguage("html").invoke(transformedDocument)
}

export { urlLoader }