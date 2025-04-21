Simple proof-of-concept MCP Server to interact with [Todoist](https://www.todoist.com). It contains a single tool as of now, but I might add more in the future if I actually end up using it.

Unlike some other Todoist MCP servers, this one uses OAuth based authorization and is deployed in Cloudflare.

## Demo

https://github.com/user-attachments/assets/3ce96d7c-cdeb-4152-8c44-e560b884c569

## How to Access
URL:  https://todoist-mcp-server-cf.debugjois.workers.dev/sse

Use the [Cloudflare AI Playground](https://playground.ai.cloudflare.com/) or [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to try it out.

Claude Desktop doesn't support remote MCPs yet, but you can use [remote-mcp](https://github.com/geelen/mcp-remote) to point to it via a proxy.

## Removing OAuth Access
Even though I could promise you that I don't do anything malicious on the server with your Todoist OAuth data, you could revoke access to it anytime from Todoist -> Settings -> Integrations

<img width="646" alt="image" src="https://github.com/user-attachments/assets/fa3f9d99-0760-465a-a456-beac729a13ba" />

## Deploy your own
The safest way to ensure your OAuth access is not misused is to deploy your own instance of this server. Change the parameters in `wrangler.jsonc` and deploy your own Cloudflare worker and point to it by doing `npm run deploy`.
