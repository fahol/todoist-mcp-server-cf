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

        // Project Management Tools

        // Create a new project
        this.server.tool(
            'create_project',
            'Create a new project in Todoist. Returns the created project with its ID and properties.',
            {
                name: z.string().describe('Name of the project to create'),
                description: z.string().optional().describe('Optional description for the project'),
                parent_id: z.string().optional().describe('ID of parent project to nest this project under'),
                color: z.enum([
                    'berry_red', 'red', 'orange', 'yellow', 'olive_green', 'lime_green', 
                    'green', 'mint_green', 'teal', 'sky_blue', 'light_blue', 'blue', 
                    'grape', 'violet', 'lavender', 'magenta', 'salmon', 'charcoal', 'grey', 'taupe'
                ]).optional().describe('Color of the project icon'),
                is_favorite: z.boolean().optional().describe('Whether to mark this project as a favorite'),
                view_style: z.enum(['list', 'board']).optional().describe('Project view style - list or board (kanban) view')
            },
            async ({ name, description, parent_id, color, is_favorite, view_style }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const project = await client.post('/projects', {
                        name,
                        description,
                        parent_id,
                        color,
                        is_favorite,
                        view_style
                    })
                    return {
                        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error creating project: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Get all projects
        this.server.tool(
            'get_projects',
            'Get all active projects from Todoist. Returns a list of projects with their properties. Supports pagination.',
            {
                cursor: z.string().optional().describe('Pagination cursor from previous response for fetching next page'),
                limit: z.number().min(1).max(200).optional().describe('Number of projects to return per page (default: 50, max: 200)')
            },
            async ({ cursor, limit }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const params: Record<string, unknown> = {}
                    if (cursor) params.cursor = cursor
                    if (limit) params.limit = limit
                    
                    const response = await client.get('/projects', params)
                    return {
                        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error fetching projects: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Get a single project
        this.server.tool(
            'get_project',
            'Get a specific project by ID from Todoist. Returns detailed information about the project.',
            {
                project_id: z.string().describe('ID of the project to retrieve')
            },
            async ({ project_id }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const project = await client.get(`/projects/${project_id}`)
                    return {
                        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error fetching project: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Update a project
        this.server.tool(
            'update_project',
            'Update an existing project in Todoist. Only provide the fields you want to update.',
            {
                project_id: z.string().describe('ID of the project to update'),
                name: z.string().optional().describe('New name for the project'),
                description: z.string().optional().describe('New description for the project'),
                color: z.enum([
                    'berry_red', 'red', 'orange', 'yellow', 'olive_green', 'lime_green', 
                    'green', 'mint_green', 'teal', 'sky_blue', 'light_blue', 'blue', 
                    'grape', 'violet', 'lavender', 'magenta', 'salmon', 'charcoal', 'grey', 'taupe'
                ]).optional().describe('New color for the project icon'),
                is_favorite: z.boolean().optional().describe('Whether to mark this project as a favorite'),
                view_style: z.enum(['list', 'board']).optional().describe('Project view style - list or board (kanban) view')
            },
            async ({ project_id, name, description, color, is_favorite, view_style }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const updateData: Record<string, unknown> = {}
                    if (name !== undefined) updateData.name = name
                    if (description !== undefined) updateData.description = description
                    if (color !== undefined) updateData.color = color
                    if (is_favorite !== undefined) updateData.is_favorite = is_favorite
                    if (view_style !== undefined) updateData.view_style = view_style
                    
                    const project = await client.post(`/projects/${project_id}`, updateData)
                    return {
                        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error updating project: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Delete a project
        this.server.tool(
            'delete_project',
            'Delete a project from Todoist. WARNING: This will permanently delete the project and all its sections and tasks.',
            {
                project_id: z.string().describe('ID of the project to delete')
            },
            async ({ project_id }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    await client.delete(`/projects/${project_id}`)
                    return {
                        content: [{ type: 'text', text: 'Project deleted successfully' }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error deleting project: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Archive a project
        this.server.tool(
            'archive_project',
            'Archive a project in Todoist. Archived projects are hidden from the active projects list but can be unarchived later.',
            {
                project_id: z.string().describe('ID of the project to archive')
            },
            async ({ project_id }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    await client.post(`/projects/${project_id}/archive`)
                    return {
                        content: [{ type: 'text', text: 'Project archived successfully' }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error archiving project: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Unarchive a project
        this.server.tool(
            'unarchive_project',
            'Unarchive a previously archived project in Todoist. This will restore the project to the active projects list.',
            {
                project_id: z.string().describe('ID of the project to unarchive')
            },
            async ({ project_id }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    await client.post(`/projects/${project_id}/unarchive`)
                    return {
                        content: [{ type: 'text', text: 'Project unarchived successfully' }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error unarchiving project: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Get project collaborators
        this.server.tool(
            'get_project_collaborators',
            'Get all collaborators for a shared project in Todoist. Returns a list of users who have access to the project.',
            {
                project_id: z.string().describe('ID of the project to get collaborators for')
            },
            async ({ project_id }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const collaborators = await client.get(`/projects/${project_id}/collaborators`)
                    return {
                        content: [{ type: 'text', text: JSON.stringify(collaborators, null, 2) }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error fetching collaborators: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Section Management Tools

        // Create a new section
        this.server.tool(
            'create_section',
            'Create a new section within a project in Todoist. Sections help organize tasks within projects.',
            {
                name: z.string().describe('Name of the section to create'),
                project_id: z.string().describe('ID of the project where the section will be created'),
                order: z.number().optional().describe('Position of the section within the project (optional)')
            },
            async ({ name, project_id, order }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const section = await client.post('/sections', {
                        name,
                        project_id,
                        order
                    })
                    return {
                        content: [{ type: 'text', text: JSON.stringify(section, null, 2) }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error creating section: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Get all sections
        this.server.tool(
            'get_sections',
            'Get all active sections from Todoist. Can filter by project or return all sections across all projects. Supports pagination.',
            {
                project_id: z.string().optional().describe('Filter sections by specific project ID (optional)'),
                cursor: z.string().optional().describe('Pagination cursor from previous response for fetching next page'),
                limit: z.number().min(1).max(200).optional().describe('Number of sections to return per page (default: 50, max: 200)')
            },
            async ({ project_id, cursor, limit }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const params: Record<string, unknown> = {}
                    if (project_id) params.project_id = project_id
                    if (cursor) params.cursor = cursor
                    if (limit) params.limit = limit
                    
                    const response = await client.get('/sections', params)
                    return {
                        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error fetching sections: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Get a single section
        this.server.tool(
            'get_section',
            'Get a specific section by ID from Todoist. Returns detailed information about the section.',
            {
                section_id: z.string().describe('ID of the section to retrieve')
            },
            async ({ section_id }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const section = await client.get(`/sections/${section_id}`)
                    return {
                        content: [{ type: 'text', text: JSON.stringify(section, null, 2) }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error fetching section: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Update a section
        this.server.tool(
            'update_section',
            'Update an existing section in Todoist. Currently only the section name can be updated.',
            {
                section_id: z.string().describe('ID of the section to update'),
                name: z.string().describe('New name for the section')
            },
            async ({ section_id, name }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    const section = await client.post(`/sections/${section_id}`, { name })
                    return {
                        content: [{ type: 'text', text: JSON.stringify(section, null, 2) }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error updating section: ${errorMessage}` }],
                        isError: true
                    }
                }
            }
        )

        // Delete a section
        this.server.tool(
            'delete_section',
            'Delete a section from Todoist. WARNING: This will permanently delete the section and all tasks within it.',
            {
                section_id: z.string().describe('ID of the section to delete')
            },
            async ({ section_id }) => {
                const client = new TodoistClient(this.props.accessToken)
                try {
                    await client.delete(`/sections/${section_id}`)
                    return {
                        content: [{ type: 'text', text: 'Section deleted successfully' }]
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    return {
                        content: [{ type: 'text', text: `Error deleting section: ${errorMessage}` }],
                        isError: true
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
