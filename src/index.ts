import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { TodoistAuthHandler } from './todoist-auth-handler.js'

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = {
    login: string
    name: string
    email: string
    accessToken: string
}

export class TodoistMCP extends McpAgent<Props, Env> {
    server = new McpServer({
        name: 'Todoist MCP Server - Deployed on Cloudflare',
        version: '1.0.0',
    })

    async init() {
        // Hello, world!
        this.server.tool('add', 'Add two numbers the way only MCP can', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
            content: [{ type: 'text', text: String(a + b) }],
        }))
    }
}

export default new OAuthProvider({
    apiRoute: '/sse',
    apiHandler: TodoistMCP.mount('/sse'),
    defaultHandler: TodoistAuthHandler,
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/token',
    clientRegistrationEndpoint: '/register',
})
