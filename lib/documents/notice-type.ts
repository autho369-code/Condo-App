// Generated letters (document_templates.letter_type) become notices with a
// notices.notice_type enum value. One mapping, used when a draft notice is
// created and when the documents list filters notices by letter type.
export function noticeTypeForLetterType(letterType: string): string {
  if (letterType === 'violation_notice') return 'violation';
  if (letterType === 'board_packet') return 'board_packet';
  if (letterType === 'assessment_letter') return 'payment_reminder';
  return 'general';
}
