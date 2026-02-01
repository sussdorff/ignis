#!/usr/bin/env bun
/**
 * Export ElevenLabs agent configuration to local files
 *
 * Usage:
 *   bun run elevenlabs/export-agent.ts
 *
 * Environment:
 *   ELEVENLABS_API_KEY - Required
 *   ELEVENLABS_AGENT_ID - Optional, defaults to agent from .env or hardcoded
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const API_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_AGENT_ID = 'agent_8101kgaq3e85ecqay2ctsjgp0y2e'

interface AgentConfig {
  agent_id: string
  name: string
  conversation_config: {
    agent: {
      prompt: {
        prompt: string
        llm: string
        tools: Tool[]
        [key: string]: unknown
      }
      first_message: string
      language: string
      [key: string]: unknown
    }
    tts: {
      voice_id: string
      model_id: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  phone_numbers: Array<{
    phone_number: string
    label: string
    provider: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

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

async function fetchAgentConfig(apiKey: string, agentId: string): Promise<AgentConfig> {
  const response = await fetch(`${API_BASE}/convai/agents/${agentId}`, {
    headers: {
      'xi-api-key': apiKey,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch agent: ${response.status} - ${error}`)
  }

  return response.json()
}

function extractSystemPrompt(config: AgentConfig): string {
  return config.conversation_config?.agent?.prompt?.prompt || ''
}

function extractTools(config: AgentConfig): Tool[] {
  return config.conversation_config?.agent?.prompt?.tools || []
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID || DEFAULT_AGENT_ID

  if (!apiKey) {
    console.error('Error: ELEVENLABS_API_KEY environment variable is required')
    console.log('Usage: ELEVENLABS_API_KEY=xxx bun run elevenlabs/export-agent.ts')
    process.exit(1)
  }

  console.log(`Fetching agent configuration for ${agentId}...`)

  const config = await fetchAgentConfig(apiKey, agentId)

  const outputDir = join(import.meta.dir)
  const toolsDir = join(outputDir, 'tools')

  // Create tools directory if it doesn't exist
  if (!existsSync(toolsDir)) {
    mkdirSync(toolsDir, { recursive: true })
  }

  // 1. Save full config (for reference and import)
  const fullConfigPath = join(outputDir, 'agent-config.json')
  writeFileSync(fullConfigPath, JSON.stringify(config, null, 2))
  console.log(`✓ Saved full config to ${fullConfigPath}`)

  // 2. Extract and save system prompt as markdown
  const systemPrompt = extractSystemPrompt(config)
  const promptPath = join(outputDir, 'system-prompt.md')
  writeFileSync(promptPath, `# ElevenLabs Agent System Prompt\n\n${systemPrompt}`)
  console.log(`✓ Saved system prompt to ${promptPath}`)

  // 3. Extract and save each tool separately
  const tools = extractTools(config)
  for (const tool of tools) {
    if (tool.type === 'system') continue // Skip built-in tools

    const toolPath = join(toolsDir, `${tool.name}.json`)
    writeFileSync(toolPath, JSON.stringify(tool, null, 2))
    console.log(`✓ Saved tool: ${tool.name}`)
  }

  // 4. Save settings (voice, timing, etc.) separately
  const settings = {
    name: config.name,
    agent_id: config.agent_id,
    llm: config.conversation_config?.agent?.prompt?.llm,
    first_message: config.conversation_config?.agent?.first_message,
    language: config.conversation_config?.agent?.language,
    voice: {
      voice_id: config.conversation_config?.tts?.voice_id,
      model_id: config.conversation_config?.tts?.model_id,
      stability: config.conversation_config?.tts?.stability,
      speed: config.conversation_config?.tts?.speed,
      similarity_boost: config.conversation_config?.tts?.similarity_boost,
    },
    phone_numbers: config.phone_numbers?.map(p => ({
      phone_number: p.phone_number,
      label: p.label,
      provider: p.provider,
    })),
  }
  const settingsPath = join(outputDir, 'agent-settings.json')
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  console.log(`✓ Saved settings to ${settingsPath}`)

  // 5. Create a summary
  console.log('\n--- Export Summary ---')
  console.log(`Agent: ${config.name} (${config.agent_id})`)
  console.log(`LLM: ${config.conversation_config?.agent?.prompt?.llm}`)
  console.log(`Voice: ${config.conversation_config?.tts?.voice_id}`)
  console.log(`Tools: ${tools.filter(t => t.type !== 'system').length} custom tools`)
  console.log(`Phone Numbers: ${config.phone_numbers?.length || 0}`)
  console.log('\nFiles created:')
  console.log('  - elevenlabs/agent-config.json (full config)')
  console.log('  - elevenlabs/agent-settings.json (key settings)')
  console.log('  - elevenlabs/system-prompt.md (editable prompt)')
  console.log('  - elevenlabs/tools/*.json (individual tools)')
}

main().catch(err => {
  console.error('Export failed:', err.message)
  process.exit(1)
})
