
from .lib import env, get_question, get_message, is_im, Client

# Use the package we installed
from slack_bolt import App

# Initializes your app with your bot token and signing secret
app = App(
    token=env.SLACK_BOT_TOKEN,
    signing_secret=env.SLACK_SIGNING_SECRET
)

client = Client()

# message sent to the bot
@app.event("message")
def handle_message_events(body, say, logger):
    if not is_im(body): return
    question = get_question(body)
    logger.info(f"Question: {question}")
    response = client.get("/ask", params={ "question": question }).json()
    answer = response["answer"]
    say(answer)
    logger.info(f"Answer: {answer}")

# reaction added to message
@app.event("reaction_added")
def handle_reaction_added_events(body, logger):
    channel, ts, text = get_message(app, body)
    response = client.post("/embeddings", json={ "text": text, "channel": channel, "ts": ts })
    logger.info(str(response))

# reaction removed from message
@app.event("reaction_removed")
def handle_reaction_removed_events(body, logger):
    channel, ts = get_message(app, body)
    response = client.delete(f"/embeddings/{channel}/{ts}")
    logger.info(str(response))

@app.error
def global_error_handler(error, body, logger):
    logger.exception(error)
    logger.info(body)

# start your app
def run():
    app.start(port=int(env.PORT))


if __name__ == "__main__":
    run()
