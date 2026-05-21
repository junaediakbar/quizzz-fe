'use client';

import { use } from 'react';
import { ExamWizard } from '@/components/teacher/exam-wizard';

export default function EditExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ExamWizard examId={id} />;
}
