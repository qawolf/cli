/**
 * Joins a sentence onto one that may not have been punctuated.
 *
 * The platform's own words end several of these messages, and a reason that
 * arrives without a full stop would otherwise run into whatever is appended:
 * "did not take effect: the click hit nothing Its screen was written to ...".
 */
export function appendSentence(text: string, sentence: string): string {
  const punctuated = /[.!?]$/.test(text.trimEnd())
    ? text.trimEnd()
    : `${text.trimEnd()}.`;
  return `${punctuated} ${sentence}`;
}
