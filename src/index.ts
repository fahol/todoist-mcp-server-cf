import { OAuthProvider } from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { TodoistAuthHandler } from './todoist-auth-handler.js'
import { TodoistApiClient } from './TodoistApiClient.js'
// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = {
    full_name: string
    email: string
    accessToken: string
}

export class TodoistMCP extends McpAgent<Env, unknown, Props> {
    server = new McpServer({
        name: 'Todoist MCP Server - Deployed on Cloudflare',
        version: '1.0.0',
    })

    async init() {
        // Todoist API - Get User Details
        this.server.tool('me', 'Get the user details of the current user from Todoist', {}, async () => {
            return {
                content: [{ type: 'text', text: JSON.stringify({ email: this.props.email, full_name: this.props.full_name }) }],
            }
        })
    }
}

export default new OAuthProvider({
    apiRoute: '/sse',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiHandler: TodoistMCP.mount('/sse') as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultHandler: TodoistAuthHandler as any,
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/token',
    clientRegistrationEndpoint: '/register',
})
