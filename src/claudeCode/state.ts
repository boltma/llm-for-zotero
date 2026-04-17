export const activeClaudeGlobalConversationByLibrary = new Map<number, number>();
export const activeClaudeConversationModeByLibrary = new Map<
  number,
  "paper" | "global"
>();
export const activeClaudePaperConversationByPaper = new Map<string, number>();

export function buildClaudePaperStateKey(
  libraryID: number,
  paperItemID: number,
): string {
  return `${Math.floor(libraryID)}:${Math.floor(paperItemID)}`;
}
