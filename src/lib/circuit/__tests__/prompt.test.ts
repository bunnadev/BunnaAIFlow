import { afterEach, describe, expect, it } from 'vitest';
import type { PartDef } from '../parts';
import { registerPart, unregisterPart } from '../registry';
import { buildCircuitLayoutPrompt, partCatalogDetailed, partCatalogShort } from '../prompt';

const custom: PartDef = { desc: 'linh kiện tự thêm thử', w: 100, h: 100, pins: { a: { x: 50, y: 0 } }, pinNote: '', render: () => '' };

afterEach(() => unregisterPart('my_custom_x'));

describe('prompt', () => {
  it('danh mục cho AI chỉ có linh kiện có sẵn, không lộ linh kiện tự thêm', () => {
    registerPart('my_custom_x', custom);
    expect(partCatalogShort()).not.toContain('my_custom_x');
    expect(partCatalogDetailed()).not.toContain('my_custom_x');
    expect(buildCircuitLayoutPrompt('thiết kế')).not.toContain('my_custom_x');
    expect(partCatalogShort()).toContain('resistor');
    expect(partCatalogDetailed()).toContain('"resistor"');
  });
});
