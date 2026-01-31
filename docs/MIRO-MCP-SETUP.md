# Miro MCP Server Setup (ig-85)

The Miro MCP server is configured in `.cursor/mcp.json` so Cursor can create and edit boards for the pitch deck (5 slides).

## One-time connection

1. **Open MCP settings in Cursor**  
   Settings → MCP (or search “MCP” in Cursor settings).

2. **Connect to Miro**  
   Find **miro-mcp** and click **Connect**.  
   Cursor will open Miro’s OAuth flow.

3. **Pick your team**  
   Choose the Miro team that has (or will have) the pitch board.  
   Miro MCP is **team-specific**; use the team where you want the deck.

4. **Finish**  
   After “Authentication successful”, you’ll be back in Cursor with Miro tools/prompts available.

## If you’re on Miro Enterprise

Your org admin may need to enable Miro’s MCP Server first:  
[Miro MCP Server admin guide](https://help.miro.com/hc/en-us/articles/31625761037202-Miro-MCP-Server-admin-guide)

## References

- [Connecting to Miro's MCP Server](https://developers.miro.com/docs/connecting-to-miro-mcp)
- [Miro MCP overview](https://developers.miro.com/docs/miro-mcp)
