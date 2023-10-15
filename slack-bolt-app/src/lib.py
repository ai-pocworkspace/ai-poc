
# import ffmpeg
import base64, httpx, os
import pydash as _
from types import SimpleNamespace
from pprint import pprint
import logging
logging.basicConfig(level=logging.INFO)
from dotenv import load_dotenv
load_dotenv()


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

def get_url_from_message(message):
    url = _.get(message, "blocks.0.elements.0.elements.1.url")
    base64_url = base64.b64encode(url.encode("ascii")).decode("ascii")
    return (url, base64_url)

def build_answer(client, question, response):
    blocks = []
    text = response["answer"]

    question_header = {
        "type": "header",
        "text": {
            "type": "plain_text",
            "text": "Question"
        }
    }
    blocks.append(question_header)

    question = {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": question
        }
    }
    blocks.append(question)

    answer_header = {
        "type": "header",
        "text": {
            "type": "plain_text",
            "text": "Answer"
        }
    }
    blocks.append(answer_header)

    answer = {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": text
        }
    }
    blocks.append(answer)

    # feedback_divider = {
    #     "type": "divider"
    # }
    # blocks.append(feedback_divider)

    feedback_header = {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "Was this answer helpful?"
        }
    }
    blocks.append(feedback_header)

    feedback = {
        "type": "actions",
        "block_id": "feedback",
        "elements": [
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "👍"
                },
                "value": "feedback_positive",
                "action_id": "feedback_positive"
            },
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "👎"
                },
                "value": "feedback_positive",
                "action_id": "feedback_negative"
            }
        ]
    }
    blocks.append(feedback)

    metadatas = _.get(response, "metadata", [])
    if len(metadatas):
        source_divider = {
            "type": "divider"
        }
        blocks.append(source_divider)

        sources = "\n".join(set(map(lambda metadata: convert_metadata(client, metadata), metadatas)))
        source = {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Source:\n{sources}"
                }
            ]
        }
        blocks.append(source)

    return ( text, blocks )

def convert_metadata(client, metadata):
    if metadata.get("type") == "url":
        return metadata.get('url')

    if metadata.get("type") == "slack":
        response = client.chat_getPermalink(token=env.SLACK_USER_TOKEN, channel=metadata.get("channel"), message_ts=metadata.get("ts"))
        return response["permalink"]

    return False

def get_file_info(client, body):
    file_id = _.get(body, "event.file_id")
    response = client.files_info(file=file_id, token=env.SLACK_USER_TOKEN)
    file_url = _.get(response, "file.url_private_download")
    file_type = _.get(response, "file.filetype")

    return (file_url, file_type)

def is_dm(body):
    return _.get(body, "event.channel_type") == "im"

# def probe(file)
