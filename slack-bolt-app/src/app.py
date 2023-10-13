
from .lib import env, get_question, get_message, get_file_info, is_dm, Httpx

# Use the package we installed
from slack_bolt import App

# Initializes your app with your bot token and signing secret
app = App(
    token=env.SLACK_BOT_TOKEN,
    signing_secret=env.SLACK_SIGNING_SECRET
)

httpx = Httpx()


# message sent to the bot
@app.event("message")
def handle_message_events(body, say, logger):
    if not is_dm(body): return
    question = get_question(body)
    logger.info(f"Question: {question}")
    response = httpx.get("/ask", params={ "question": question }).json()

    if "answer" in response:
        answer = response["answer"]
        context = response["context"]
        vectorMatches = response["vectorMatches"]
        say(answer)
        logger.info(f"Answer: {answer}\nContext: {str(context)}\nVector Matches: {str(vectorMatches)}")


# reaction added to message
@app.event("reaction_added")
def handle_reaction_added_events(body, client, logger):
    channel, ts, text = get_message(client, body)
    response = httpx.post("/embeddings", json={ "text": text, "source": "slack", "channel": channel, "ts": ts })
    logger.info(str(response))

# reaction removed from message
@app.event("reaction_removed")
def handle_reaction_removed_events(body, client, logger):
    channel, ts, _ = get_message(client, body)
    response = httpx.delete(f"/embeddings/{channel}/{ts}")
    logger.info(str(response))

# file created in slack
@app.event("file_created")
def handle_file_created_events(body, client, say, logger):
    file_url, file_type = get_file_info(client, body)
    if file_type == "mp3":
        response = httpx.post("/transcribe", json={"file_url": file_url})
        logger.info(response)
    # elif file_type == "mp4":
    #     # do nothing for now
    # else:
    #     say(f"File type not supported for {file_type} {file_url}")



@app.error
def global_error_handler(error, body, logger):
    logger.exception(error)
    logger.info(body)

# start your app
def run():
    app.start(port=int(env.PORT))


if __name__ == "__main__":
    run()
