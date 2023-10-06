import os

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

# Add functionality here
# @app.event("app_home_opened") etc

@app.event("app_mention")
def handle_app_mention_events(body, say, logger):
    logger.info(body)
    say("What's up?")

@app.event("reaction_added")
def handle_reaction_added_events(body, logger):
    logger.info("WTF")
    logger.info(body)

@app.event("reaction_removed")
def handle_reaction_removed_events(body, logger):
    logger.info(body)

@app.error
def global_error_handler(error, body, logger):
    logger.exception(error)
    logger.info(body)

# Start your app
def run():
    app.start(port=int(os.environ.get("PORT", 8000)))


if __name__ == "__main__":
    run()
