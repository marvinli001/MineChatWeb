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
  url: string
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
          .map(server => ({
            type: 'mcp_server',
            server_name: server!.name,
            server_url: server!.url,
            description: server!.description
          }))
      }
    }),
    {
      name: 'plugin-store',
      version: 1
    }
  )
)