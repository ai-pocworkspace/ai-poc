# Create a local tunnel

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