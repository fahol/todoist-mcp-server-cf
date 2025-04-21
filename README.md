Simple proof-of-concept MCP Server to interact with [Todoist](https://www.todoist.com). It contains a single tool as of now, but I might add more in the future if I actually end up using it.

Unlike some other Todoist MCP servers, this one uses OAuth based authorization and is deployed in Cloudflare.

## Demo

https://github.com/user-attachments/assets/3ce96d7c-cdeb-4152-8c44-e560b884c569

## How to Access
URL:  https://todoist-mcp-server-cf.debugjois.workers.dev/sse

Use the [Cloudflare AI Playground](https://playground.ai.cloudflare.com/) or [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to try it out.

Claude Desktop doesn't support remote MCPs yet, but you can use [remote-mcp](https://github.com/geelen/mcp-remote) to point to it via a proxy.

## Deploy your own
Change the parameters in `wrangler.jsonc` and deploy your own Cloudflare worker and point to it.
