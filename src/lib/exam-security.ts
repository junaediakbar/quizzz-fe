import type { ExamConfig } from '@/lib/types';

/** Proctoring settings returned with exam config / session start */
export interface ExamSecuritySettings {
  enabled: boolean;
  maxViolations: number;
  requireFullscreen: boolean;
  blockCopyPaste: boolean;
  detectFocusLoss: boolean;
}

export const DEFAULT_EXAM_SECURITY: ExamSecuritySettings = {
  enabled: true,
  maxViolations: 3,
  requireFullscreen: true,
  blockCopyPaste: true,
  detectFocusLoss: true,
};

export function securityFromExamConfig(config: ExamConfig): ExamSecuritySettings {
  if (!config.securityEnabled) {
    return {
      enabled: false,
      maxViolations: 0,
      requireFullscreen: false,
      blockCopyPaste: false,
      detectFocusLoss: false,
    };
  }
  return {
    enabled: true,
    maxViolations: config.maxViolations,
    requireFullscreen: config.requireFullscreen,
    blockCopyPaste: config.blockCopyPaste,
    detectFocusLoss: config.detectFocusLoss,
  };
}

export function mapSecurityFromApi(raw: Record<string, unknown> | undefined): ExamSecuritySettings {
  if (!raw) return DEFAULT_EXAM_SECURITY;
  return {
    enabled: Boolean(raw.enabled ?? raw.security_enabled ?? true),
    maxViolations: Number(raw.max_violations ?? raw.maxViolations ?? 3),
    requireFullscreen: Boolean(raw.require_fullscreen ?? raw.requireFullscreen ?? true),
    blockCopyPaste: Boolean(raw.block_copy_paste ?? raw.blockCopyPaste ?? true),
    detectFocusLoss: Boolean(raw.detect_focus_loss ?? raw.detectFocusLoss ?? true),
  };
}

/** Label for violation tolerance in teacher UI */
export function formatMaxViolationsLabel(max: number): string {
  if (max <= 0) return 'Tidak mengunci otomatis';
  return `${max} pelanggaran`;
}

/** Apply securityEnabled toggle while preserving other config fields */
export function withSecurityEnabled(config: ExamConfig, enabled: boolean): ExamConfig {
  return {
    ...config,
    securityEnabled: enabled,
    ...(enabled && config.maxViolations === 0 ? { maxViolations: 3 } : {}),
  };
}
