import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';
import { hasDeterministicKey } from '@/lib/gameplay/grading/deterministic';
import {
  isLlmConfigured,
  rescueFreeText,
  gradeOpenEnded,
  gradeCode,
  acceptedAnswers,
  isFixedAnswerKey,
} from '@/lib/gameplay/grading/llm';
import { applyGradingOverride } from '@/lib/gameplay/grading/service';

const db = supabaseServer as any;

const autoReviewSchema = z.object({
  submission_id: z.string().uuid(),
});

/**
 * Runs the LLM grading pipeline on a manual-review submission and either
 * auto-applies the score (when confidence is high) or returns the verdict
 * for the admin to accept/reject.
 *
 * POST /api/admin/grade/auto-review
 *
 * Body: { submission_id: string, apply?: boolean }
 *
 * - When `apply` is false/absent: returns the AI verdict without saving
 * - When `apply` is true: applies the verdict as a grading override
 */
export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  if (!isLlmConfigured()) {
    return NextResponse.json(
      { success: false, error: { code: 'LLM_NOT_CONFIGURED', message: 'GROQ_API_KEY is not set.' } },
      { status: 503 },
    );
  }

  let body: { submission_id?: string; apply?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Malformed request body.' } },
      { status: 400 },
    );
  }

  const parsed = autoReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PAYLOAD', message: 'submission_id (uuid) is required.' } },
      { status: 400 },
    );
  }

  try {
    // Fetch the submission
    const { data: submission, error: subError } = await db
      .from('submissions')
      .select('id, team_id, round_id, question_id, answer_text, code, language, revision, status')
      .eq('id', parsed.data.submission_id)
      .single();

    if (subError || !submission) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Submission not found.' } },
        { status: 404 },
      );
    }

    // Fetch the question with prompt, expected_answer, rubric
    const { data: question, error: qError } = await db
      .from('questions')
      .select('id, type, prompt, expected_answer, rubric, reward, hidden_test_cases')
      .eq('id', submission.question_id)
      .single();

    if (qError || !question) {
      return NextResponse.json(
        { success: false, error: { code: 'QUESTION_NOT_FOUND', message: 'Question not found.' } },
        { status: 404 },
      );
    }

    const answer = submission.answer_text ?? submission.code ?? '';
    let verdict: { score: number; reasoning: string } | null = null;
    let strategy = 'unknown';

    // Decide which LLM grading path to use
    if (question.type === 'coding') {
      // For coding questions, check if we have test results from grading_items
      const { data: gradingItem } = await db
        .from('grading_items')
        .select('provider_metadata')
        .eq('submission_id', submission.id)
        .eq('state', 'manual_review')
        .maybeSingle();

      const metadata = gradingItem?.provider_metadata as Record<string, unknown> | null;
      const cases = Array.isArray(question.hidden_test_cases) ? question.hidden_test_cases : [];

      verdict = await gradeCode({
        prompt: question.prompt ?? '',
        language: submission.language ?? 'unknown',
        code: submission.code ?? '',
        passed: typeof metadata?.passed === 'number' ? metadata.passed : 0,
        total: cases.length,
      });
      strategy = 'code_review';
    } else if (hasDeterministicKey(question.expected_answer) && !isFixedAnswerKey(question.expected_answer)) {
      // Free-text answer that failed deterministic match — ask LLM if it means the same
      const accepted = acceptedAnswers(question.expected_answer);
      verdict = await rescueFreeText({
        prompt: question.prompt ?? '',
        accepted,
        answer,
      });
      strategy = 'free_text_rescue';
    } else if (question.rubric || question.type === 'logic_puzzle') {
      // Open-ended with rubric
      verdict = await gradeOpenEnded({
        prompt: question.prompt ?? '',
        rubric: question.rubric,
        answer,
      });
      strategy = 'open_ended';
    } else {
      // Fallback: grade as open-ended
      verdict = await gradeOpenEnded({
        prompt: question.prompt ?? '',
        rubric: null,
        answer,
      });
      strategy = 'open_ended_fallback';
    }

    if (!verdict) {
      return NextResponse.json({
        success: true,
        data: {
          verdict: null,
          strategy,
          message: 'The AI could not produce a verdict. Score manually.',
        },
      });
    }

    // If apply is true, apply the verdict as a grading override
    if (body.apply) {
      const score = verdict.score >= 0.5 ? 1 : 0;
      const result = await applyGradingOverride({
        submissionId: submission.id,
        score,
        reason: `[AI ${strategy}] ${verdict.reasoning}`,
        adminId: guard.adminId,
      });

      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: { code: result.code, message: result.message } },
          { status: result.status },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          verdict,
          strategy,
          applied: true,
          applied_score: score,
          override: result.data,
        },
      });
    }

    // Just return the verdict for admin review
    return NextResponse.json({
      success: true,
      data: {
        verdict,
        strategy,
        applied: false,
        question_prompt: (question.prompt ?? '').slice(0, 500),
      },
    });
  } catch (error) {
    console.error('Auto-review error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'AI grading failed unexpectedly.' } },
      { status: 500 },
    );
  }
}
