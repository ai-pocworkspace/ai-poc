import os

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

@app.event("reaction_added")
def handle_reaction_added_events(body, logger):
    logger.info(body)

@app.event("reaction_removed")
def handle_reaction_removed_events(body, logger):
    logger.info(body)

# Start your app
if __name__ == "__main__":
    app.start(port=int(os.environ.get("PORT", 8000)))