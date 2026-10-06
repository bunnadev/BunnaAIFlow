import type React from 'react';

/**
 * WKWebView không bắn blur khi ô nhập đang gõ bị gỡ khỏi trang — chủ động
 * rời ô nhập (để ô ghi giá trị) trước khi bấm bàn vẽ / nút.
 */
export function blurActiveField(): void {
  const a = document.activeElement;
  if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) a.blur();
}

/** Gắn vào onMouseDown của nút: nút không giữ tiêu điểm (Space để kéo bàn vẽ không bấm lại nút). */
export function noFocusMouseDown(e: React.MouseEvent): void {
  blurActiveField();
  e.preventDefault();
}
