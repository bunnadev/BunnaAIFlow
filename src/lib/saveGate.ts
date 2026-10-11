/**
 * Khoá ghi dữ liệu: đang khôi phục bản sao lưu thì các lần tự lưu (workflow, cài đặt, mạch)
 * không được ghi đè lên dữ liệu vừa khôi phục — app tải lại ngay sau đó.
 */
let suspended = false;

export function suspendSaves(): void {
  suspended = true;
}

export function resumeSaves(): void {
  suspended = false;
}

export function savesSuspended(): boolean {
  return suspended;
}
