
from .lib import env, get_question, get_message, build_answer, get_file_info, is_dm, Httpx

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
def handle_message_events(body, client, say, logger):
    if not is_dm(body): return
    question = get_question(body)
    logger.info(f"Question: {question}")
    response = httpx.get("/ask", params={ "question": question }).json()

    if "answer" in response:
        text, blocks = build_answer(client, question, response)
        say(text=text, blocks=blocks)
        logger.info(f"Answer: {text}")
        # context = response["context"]
        # vectorMatches = response["vectorMatches"]
        # logger.info(f"Answer: {answer}\nContext: {str(context)}\nVector Matches: {str(vectorMatches)}")
    elif "error" in response:
        error = response["error"]
        say(f"An error occurred! {str(error)}")
    else:
        say("Whoops! We didn't seem to get a timely response from the AI POC Bot.")


# reaction added to message
@app.event("reaction_added")
def handle_reaction_added_events(body, client, logger):
    channel, ts, text = get_message(client, body)
    metadata = { "channel": channel, "ts" : ts }
    response = httpx.post("/embeddings", json={ "external_id": f"{channel}:{ts}", "text": text, "source": "slack", "metadata": metadata })
    logger.info(str(response))

# reaction removed from message
@app.event("reaction_removed")
def handle_reaction_removed_events(body, client, logger):
    channel, ts, _ = get_message(client, body)
    response = httpx.delete(f"/embeddings/{channel}:{ts}")
    logger.info(str(response))



# upvote answer
@app.action({
    "block_id": "feedback",
    "action_id": "feedback_positive"
})
def update_message(ack, say):
    ack()
    say("Thanks for your feedback!")

# downvote answer
@app.action("feedback_negative")
def update_message(ack, say):
    ack()
    say("Thanks for your feedback!")

# file created in slack
# @app.event("file_created")
# def handle_file_created_events(body, client, say, logger):
#     file_url, file_type = get_file_info(client, body)
#     if file_type == "mp3":
#         response = httpx.post("/transcribe", json={"file_url": file_url})
#         logger.info(response)
#     # elif file_type == "mp4":
#     #     # do nothing for now
#     # else:
#     #     say(f"File type not supported for {file_type} {file_url}")

@app.error
def global_error_handler(error, body, logger):
    logger.exception(error)
    logger.info(body)

# start your app
def run():
    app.start(port=int(env.PORT))


if __name__ == "__main__":
    run()
