
import os
import httpx
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
env.SLACK_SIGNING_SECRET = os.environ.get("SLACK_SIGNING_SECRET")


def get_message(app, body):
    channel = _.get(body, "event.item.channel")
    ts = _.get(body, "event.item.ts")
    response = app.client.conversations_history(
        channel=channel,
        inclusive=True,
        oldest=ts,
        limit=1
    )
    text = _.get(response, "messages.0.text", default="")

    return ( channel, ts, text )

def get_question(event):
    return _.get(event, "event.blocks.0.elements.0.elements.0.text", default="")

def is_im(body):
    return _.get(body, "event.channel_type") == "im"

def Client():
    return httpx.Client(base_url=env.WORKER_HOST, timeout=5)