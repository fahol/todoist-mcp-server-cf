import { OAuthProvider } from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { TodoistAuthHandler } from './todoist-auth-handler.js'
import { TodoistClient } from './TodoistApiClient.js'
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

        // Get tasks by filter
        this.server.tool(
            'get_tasks_by_filter',
            'Get tasks that match a Todoist filter query',
            {
                filter: z
                    .string()
                    .describe(
                        'Filter by any [supported filter](https://todoist.com/help/articles/introduction-to-filters-V98wIH). Multiple filters (using the comma `,` operator) are not supported.'
                    ),
            },
            async ({ filter }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const tasks = (await client.get('/tasks/filter', { query: filter, limit: 200 })) as {
                        next_cursor?: string
                        results: Array<{
                            content: string
                            description: string
                            due?: { date: string }
                        }>
                    }

                    // check if tasks exceeds 200 by checking next_cursor
                    if (tasks.next_cursor) {
                        return {
                            content: [{ type: 'text', text: 'Tasks limit exceeded' }],
                        }
                    }

                    // Extract required fields and format the response
                    const formattedTasks = tasks.results.map((task) => ({
                        content: task.content,
                        description: task.description,
                        due_date: task.due?.date || null,
                    }))

                    return {
                        content: [{ type: 'text', text: JSON.stringify(formattedTasks, null, 2) }],
                    }
                } catch (error: unknown) {
                    console.error('Failed to fetch tasks:', error)
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error fetching tasks: ${errorMessage}` }],
                        isError: true,
                    }
                }
            }
        )
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
