export const pvpQuestionFields = ['id', 'display_order', 'type', 'prompt', 'content', 'language_options', 'time_limit_seconds'] as const;

export function serializeSafePvpQuestion(question: any) {
  return {
    id: question.id,
    display_order: question.display_order,
    type: question.type,
    prompt: question.prompt,
    content: question.content ?? {},
    language_options: question.language_options ?? [],
    time_limit_seconds: question.time_limit_seconds ?? null,
  };
}