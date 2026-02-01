#!/usr/bin/env bun
/**
 * Import/Update ElevenLabs agent configuration from local files
 *
 * Usage:
 *   bun run elevenlabs/import-agent.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be changed without making updates
 *
 * Environment:
 *   ELEVENLABS_API_KEY - Required
 *   ELEVENLABS_AGENT_ID - Optional, defaults to agent from settings or hardcoded
 *
 * This script reads from:
 *   - elevenlabs/system-prompt.md (updates agent prompt)
 *   - elevenlabs/tools/*.json (updates tool configurations)
 *   - elevenlabs/agent-settings.json (updates voice/timing settings)
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const API_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_AGENT_ID = 'agent_8101kgaq3e85ecqay2ctsjgp0y2e'

interface Tool {
  type: string
  name: string
  description: string
  api_schema?: {
    url: string
    method: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface AgentSettings {
  agent_id: string
  name: string
  llm: string
  first_message: string
  language: string
  voice: {
    voice_id: string
    model_id: string
    stability?: number
    speed?: number
    similarity_boost?: number
  }
}

async function fetchCurrentConfig(apiKey: string, agentId: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}/convai/agents/${agentId}`, {
    headers: { 'xi-api-key': apiKey },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch agent: ${response.status}`)
  }
  return response.json()
}

async function updateAgent(apiKey: string, agentId: string, patch: unknown): Promise<void> {
  const response = await fetch(`${API_BASE}/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update agent: ${response.status} - ${error}`)
  }
}

function loadSystemPrompt(dir: string): string | null {
  const promptPath = join(dir, 'system-prompt.md')
  if (!existsSync(promptPath)) return null

  const content = readFileSync(promptPath, 'utf-8')
  // Remove the markdown header if present
  const lines = content.split('\n')
  if (lines[0]?.startsWith('# ')) {
    lines.shift() // Remove header
    if (lines[0] === '') lines.shift() // Remove blank line after header
  }
  return lines.join('\n').trim()
}

function loadTools(dir: string): Tool[] {
  const toolsDir = join(dir, 'tools')
  if (!existsSync(toolsDir)) return []

  const tools: Tool[] = []
  const files = readdirSync(toolsDir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const toolPath = join(toolsDir, file)
    const tool = JSON.parse(readFileSync(toolPath, 'utf-8'))
    tools.push(tool)
  }

  return tools
}

function loadSettings(dir: string): AgentSettings | null {
  const settingsPath = join(dir, 'agent-settings.json')
  if (!existsSync(settingsPath)) return null
  return JSON.parse(readFileSync(settingsPath, 'utf-8'))
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    console.error('Error: ELEVENLABS_API_KEY environment variable is required')
    process.exit(1)
  }

  const dir = import.meta.dir

  // Load settings to get agent ID
  const settings = loadSettings(dir)
  const agentId = process.env.ELEVENLABS_AGENT_ID || settings?.agent_id || DEFAULT_AGENT_ID

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Updating agent ${agentId}...`)

  // Fetch current config for comparison
  const currentConfig = await fetchCurrentConfig(apiKey, agentId) as {
    conversation_config?: {
      agent?: {
        prompt?: { prompt?: string; tools?: Tool[] }
        first_message?: string
      }
      tts?: { voice_id?: string }
    }
  }

  // Build patch object
  const patch: {
    conversation_config?: {
      agent?: {
        prompt?: { prompt?: string; tools?: Tool[] }
        first_message?: string
      }
      tts?: { voice_id?: string; stability?: number; speed?: number; similarity_boost?: number }
    }
  } = {
    conversation_config: {},
  }

  // 1. Load and apply system prompt
  const systemPrompt = loadSystemPrompt(dir)
  if (systemPrompt) {
    const currentPrompt = currentConfig.conversation_config?.agent?.prompt?.prompt
    if (currentPrompt !== systemPrompt) {
      console.log('✓ System prompt changed')
      if (!patch.conversation_config) patch.conversation_config = {}
      if (!patch.conversation_config.agent) patch.conversation_config.agent = {}
      if (!patch.conversation_config.agent.prompt) patch.conversation_config.agent.prompt = {}
      patch.conversation_config.agent.prompt.prompt = systemPrompt
    } else {
      console.log('- System prompt unchanged')
    }
  }

  // 2. Load and apply tools
  const tools = loadTools(dir)
  if (tools.length > 0) {
    const currentTools = currentConfig.conversation_config?.agent?.prompt?.tools || []
    const currentToolNames = new Set(currentTools.filter((t: Tool) => t.type !== 'system').map((t: Tool) => t.name))
    const newToolNames = new Set(tools.map(t => t.name))

    const added = tools.filter(t => !currentToolNames.has(t.name))
    const removed = [...currentToolNames].filter(name => !newToolNames.has(name as string))

    if (added.length > 0 || removed.length > 0) {
      console.log(`✓ Tools changed: +${added.length} added, -${removed.length} removed`)
      if (added.length > 0) console.log(`  Added: ${added.map(t => t.name).join(', ')}`)
      if (removed.length > 0) console.log(`  Removed: ${removed.join(', ')}`)

      // Preserve system tools and add custom tools
      const systemTools = currentTools.filter((t: Tool) => t.type === 'system')
      if (!patch.conversation_config) patch.conversation_config = {}
      if (!patch.conversation_config.agent) patch.conversation_config.agent = {}
      if (!patch.conversation_config.agent.prompt) patch.conversation_config.agent.prompt = {}
      patch.conversation_config.agent.prompt.tools = [...systemTools, ...tools]
    } else {
      console.log(`- Tools unchanged (${tools.length} custom tools)`)
    }
  }

  // 3. Load and apply settings
  if (settings) {
    if (settings.first_message && settings.first_message !== currentConfig.conversation_config?.agent?.first_message) {
      console.log('✓ First message changed')
      if (!patch.conversation_config) patch.conversation_config = {}
      if (!patch.conversation_config.agent) patch.conversation_config.agent = {}
      patch.conversation_config.agent.first_message = settings.first_message
    }

    if (settings.voice?.voice_id && settings.voice.voice_id !== currentConfig.conversation_config?.tts?.voice_id) {
      console.log('✓ Voice ID changed')
      if (!patch.conversation_config) patch.conversation_config = {}
      if (!patch.conversation_config.tts) patch.conversation_config.tts = {}
      patch.conversation_config.tts.voice_id = settings.voice.voice_id
    }
  }

  // Check if there are any changes
  const hasChanges = Object.keys(patch.conversation_config || {}).length > 0

  if (!hasChanges) {
    console.log('\nNo changes to apply.')
    return
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would apply the following patch:')
    console.log(JSON.stringify(patch, null, 2))
  } else {
    console.log('\nApplying changes...')
    await updateAgent(apiKey, agentId, patch)
    console.log('✓ Agent updated successfully!')
  }
}

main().catch(err => {
  console.error('Import failed:', err.message)
  process.exit(1)
})
