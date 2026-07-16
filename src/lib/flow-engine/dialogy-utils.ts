import { getProperty } from 'dot-prop';

const DIALOGY_MESSAGE_VALUE_PATHS = [
  'message.rowId',
  'message.row_id',
  'message.selectedRowId',
  'message.selected_row_id',
  'message.listReply.rowId',
  'message.listReply.row_id',
  'message.list_reply.rowId',
  'message.list_reply.row_id',
  'message.interactive.listReply.rowId',
  'message.interactive.listReply.row_id',
  'message.interactive.list_reply.id',
  'message.interactive.list_reply.rowId',
  'message.interactive.list_reply.row_id',
  'message.metadata.rowId',
  'message.metadata.row_id',
  'message.metadata.selectedRowId',
  'message.metadata.selected_row_id',
  'message.metadata.listReply.rowId',
  'message.metadata.listReply.row_id',
  'message.content',
  'message.body',
  'text',
] as const;

export function extractDialogyIncomingMessageValue(payload: any): string {
  for (const path of DIALOGY_MESSAGE_VALUE_PATHS) {
    const rawValue = getProperty(payload, path);
    if (rawValue === undefined || rawValue === null) continue;
    const text = String(rawValue).trim();
    if (text.length > 0) {
      return text;
    }
  }
  return '';
}
