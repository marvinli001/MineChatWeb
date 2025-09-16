'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Plugin {
  id: string
  name: string
  description: string
  type: 'function'
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
    additionalProperties?: boolean
  }
  strict?: boolean
  created_at: string
}

export interface MCPServer {
  id: string
  name: string
  description: string
  url?: string
  connector_id?: string // 内置连接器ID
  authorization?: string // OAuth授权令牌
  require_approval?: string // 审批要求配置
  allowed_tools?: string[] // 允许的工具列表
  created_at: string
}

interface PluginState {
  plugins: Plugin[]
  mcpServers: MCPServer[]

  // Actions
  addPlugin: (plugin: Omit<Plugin, 'id' | 'created_at'>) => void
  removePlugin: (id: string) => void
  updatePlugin: (id: string, updates: Partial<Plugin>) => void

  addMCPServer: (server: Omit<MCPServer, 'id' | 'created_at'>) => void
  removeMCPServer: (id: string) => void
  updateMCPServer: (id: string, updates: Partial<MCPServer>) => void

  // Getters
  getPluginById: (id: string) => Plugin | null
  getMCPServerById: (id: string) => MCPServer | null
  getAllPlugins: () => Plugin[]
  getAllMCPServers: () => MCPServer[]

  // Convert to tool format for AI providers
  convertPluginsToTools: (pluginIds: string[]) => any[]
  convertMCPServersToTools: (serverIds: string[]) => any[]
}

export const usePluginStore = create<PluginState>()(
  persist(
    (set, get) => ({
      plugins: [],
      mcpServers: [],

      addPlugin: (pluginData) => {
        const plugin: Plugin = {
          ...pluginData,
          id: `plugin_${Date.now()}`,
          created_at: new Date().toISOString()
        }

        set(state => ({
          plugins: [...state.plugins, plugin]
        }))
      },

      removePlugin: (id) => {
        set(state => ({
          plugins: state.plugins.filter(p => p.id !== id)
        }))
      },

      updatePlugin: (id, updates) => {
        set(state => ({
          plugins: state.plugins.map(p =>
            p.id === id ? { ...p, ...updates } : p
          )
        }))
      },

      addMCPServer: (serverData) => {
        const server: MCPServer = {
          ...serverData,
          id: `mcp_${Date.now()}`,
          created_at: new Date().toISOString()
        }

        set(state => ({
          mcpServers: [...state.mcpServers, server]
        }))
      },

      removeMCPServer: (id) => {
        set(state => ({
          mcpServers: state.mcpServers.filter(s => s.id !== id)
        }))
      },

      updateMCPServer: (id, updates) => {
        set(state => ({
          mcpServers: state.mcpServers.map(s =>
            s.id === id ? { ...s, ...updates } : s
          )
        }))
      },

      getPluginById: (id) => {
        const { plugins } = get()
        return plugins.find(p => p.id === id) || null
      },

      getMCPServerById: (id) => {
        const { mcpServers } = get()
        return mcpServers.find(s => s.id === id) || null
      },

      getAllPlugins: () => {
        return get().plugins
      },

      getAllMCPServers: () => {
        return get().mcpServers
      },

      convertPluginsToTools: (pluginIds) => {
        const { plugins } = get()
        return pluginIds
          .map(id => plugins.find(p => p.id === id))
          .filter(Boolean)
          .map(plugin => ({
            type: 'function',
            name: plugin!.name,
            description: plugin!.description,
            parameters: plugin!.parameters,
            strict: plugin!.strict
          }))
      },

      convertMCPServersToTools: (serverIds) => {
        const { mcpServers } = get()
        return serverIds
          .map(id => mcpServers.find(s => s.id === id))
          .filter(Boolean)
          .map(server => {
            const tool: any = {
              type: 'mcp',
              server_label: server!.name,
              server_description: server!.description
            }

            // 添加远程MCP服务器URL或内置连接器ID
            if (server!.connector_id) {
              tool.connector_id = server!.connector_id
            } else if (server!.url) {
              tool.server_url = server!.url
            }

            // 添加可选配置
            if (server!.authorization) {
              tool.authorization = server!.authorization
            }

            if (server!.require_approval !== undefined) {
              tool.require_approval = server!.require_approval
            }

            if (server!.allowed_tools && server!.allowed_tools.length > 0) {
              tool.allowed_tools = server!.allowed_tools
            }

            return tool
          })
      }
    }),
    {
      name: 'plugin-store',
      version: 1
    }
  )
)