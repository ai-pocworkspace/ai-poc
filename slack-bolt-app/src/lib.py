
import os
import httpx
# import ffmpeg
import pydash as _
import logging
logging.basicConfig(level=logging.INFO)
from dotenv import load_dotenv
load_dotenv()

from types import SimpleNamespace

env = SimpleNamespace()
env.PORT = os.environ.get("PORT", 8000)
env.WORKER_HOST = os.environ.get("WORKER_HOST")
env.SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")
env.SLACK_USER_TOKEN = os.environ.get("SLACK_USER_TOKEN")
env.SLACK_SIGNING_SECRET = os.environ.get("SLACK_SIGNING_SECRET")

def Httpx():
    timeout = httpx.Timeout(10.0, read=10.0)
    return httpx.Client(base_url=env.WORKER_HOST, timeout=timeout)

def get_question(body):
    return _.get(body, "event.blocks.0.elements.0.elements.0.text", default="")

def get_message(client, body):
    channel = _.get(body, "event.item.channel")
    ts = _.get(body, "event.item.ts")
    response = client.conversations_history(
        channel=channel,
        inclusive=True,
        oldest=ts,
        limit=1
    )
    text = _.get(response, "messages.0.text", default="")

    return ( channel, ts, text )

def build_answer(response):
    answer = response["answer"]
    sources = _.get(response, "metadata.sources", [])
    context = response["context"]
    vectorMatches = response["vectorMatches"]
    source = "\nSource:\n" + "\n".join(sources) if len(sources) else ""

    return ( answer, source, context, vectorMatches )

def get_file_info(client, body):
    file_id = _.get(body, "event.file_id")
    response = client.files_info(file=file_id, token=env.SLACK_USER_TOKEN)
    file_url = _.get(response, "file.url_private_download")
    file_type = _.get(response, "file.filetype")

    return (file_url, file_type)

def is_dm(body):
    return _.get(body, "event.channel_type") == "im"

# def probe(file)
