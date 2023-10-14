# AI POC

![alt text](https://github.com/ai-pocworkspace/ai-poc/blob/main/diagram.png?raw=true)

## Install and run the python slack bolt app (https://ai-poc.jhnnygrn.com)

This app can be managed at the following link - https://api.slack.com/apps/A05V1CYAWP8.

Install the poetry python dependency manager and pyenv
```
brew install poetry pyenv
pyenv install 3.12
pyenv globall 3.12
```

Check that you are running the correct python version
```
python3 --version
```

If not, close and reopen the terminal app ... check again

Go into the slack bolt app directory and install
```
cd slack-bolt-app
poetry install
```

Setup the env variables
```
cp .env.example .env # also fill out the variables
```

Run the bolt app
```
poetry run app
```


## Install and run the cloudflare worker ai app (https://cf-worker-ai.jhnnygrn.com)

Install nvm and Node.js v18
```
brew install nvm
nvm install v18
```

Install the npm deps
```
cd cf-worker-ai
npm install
```

Log in the cloudflare / wrangler
```
npx wrangler login
```

Run the wrangler / cloudflare worker ai app locally
```
npx wrangler dev --remote
```

To deploy changes to the live work
```
npx wrangler deploy
```


## Create a local tunnel to the running python slack bolt app

https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/

Install cloudflared
```
brew install cloudflare/cloudflare/cloudflared
```

Point the tunnel to your local running app
```
cloudflared tunnel --config .cloudflared/config.yml run ai-poc
```


This will allow the local runnings app to be accessible via `https://ai-poc.jhnnygrn.com` so that Slack can send messages to it.
