export const commandExamples: Record<string, string> = {
  "codingAgent submitWebhook": `
Examples:
  $ qawolf codingAgent submitWebhook --url https://agent.example.com/qawolf
  $ qawolf codingAgent submitWebhook --format cursor-automation \\
      --url https://api2.cursor.sh/automations/webhook/<automation-id> \\
      --trigger-token "$CURSOR_AUTOMATION_KEY"
  $ qawolf codingAgent submitWebhook --format claude-code-routine \\
      --url https://api.anthropic.com/v1/claude_code/routines/<trigger-id>/fire \\
      --trigger-token "$CLAUDE_TRIGGER_TOKEN"
  $ qawolf codingAgent sendWebhookTest`,
  "trigger create": `
Examples:
  $ qawolf trigger create --name "Fix new bugs" --kind issue \\
      --issue-type bug --issue-event created --action-kind startAgent \\
      --action-instructions "Fix the bug using /coding-agent. Keep the change small."`,
};
