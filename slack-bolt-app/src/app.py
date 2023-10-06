import os
import httpx
import logging
logging.basicConfig(level=logging.INFO)

from dotenv import load_dotenv
load_dotenv()

# Use the package we installed
from slack_bolt import App


# Initializes your app with your bot token and signing secret
app = App(
    token=os.environ.get("SLACK_BOT_TOKEN"),
    signing_secret=os.environ.get("SLACK_SIGNING_SECRET")
)

def get_message(channel, ts):
    result = app.client.conversations_history(
        channel=channel,
        inclusive=True,
        oldest=ts,
        limit=1
    )
    return result["messages"][0]["text"]

def get_question(event):
    return event["blocks"][0]["elements"][0]["elements"][0]["text"]

# message sent to the bot
@app.event("message")
def handle_message_events(body, say, logger):
    question = get_question(body["event"])
    logger.info(f"Question: {question}")
    answer = httpx.get("http://localhost:8787/ask", params={"question": question}).json()["answer"]
    say(answer)

# reaction added to message
@app.event("reaction_added")
def handle_reaction_added_events(body, logger):
    channel = body["event"]["item"]["channel"]
    ts = body["event"]["item"]["ts"]
    message = get_message(channel, ts)
    logger.info(f"Reaction Added to: {message}")

# reaction removed from message
@app.event("reaction_removed")
def handle_reaction_removed_events(body, logger):
    channel = body["event"]["item"]["channel"]
    ts = body["event"]["item"]["ts"]
    message = get_message(channel, ts)
    logger.info(f"Reaction Removed from: {message}")

@app.error
def global_error_handler(error, body, logger):
    logger.exception(error)
    logger.info(body)

# Start your app
def run():
    app.start(port=int(os.environ.get("PORT", 8000)))


if __name__ == "__main__":
    run()
