# AI POC

## Install and run the python slack bolt app

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
python3 app.py
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

This will allow the local app to be accessible via `ai-poc.jhnnygrn.com`.