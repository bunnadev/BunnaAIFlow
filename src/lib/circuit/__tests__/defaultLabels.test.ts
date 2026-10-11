import { describe, expect, it } from 'vitest';
import { addPart } from '../ops';
import { BUILTIN_LIBRARY } from '../libraryCatalog';

// Nhãn xanh in thẳng lên ảnh mạch đăng cho khán giả nước ngoài → mặc định phải là tiếng Anh.
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

describe('nhãn mặc định khi kéo linh kiện ra', () => {
  it.each(BUILTIN_LIBRARY.map((it) => [it.type, it.idBase] as const))('%s: nhãn tiếng Anh', (type, idBase) => {
    const { layout, id } = addPart({ width: 1080, height: 1350, parts: [], wires: [] }, type, 500, 500, idBase);
    const label = layout.parts.find((p) => p.id === id)?.label ?? '';
    expect(label.normalize('NFC')).not.toMatch(VIETNAMESE);
  });

  it('IR và còi dùng tên tiếng Anh', () => {
    const label = (type: string) => addPart({ width: 1080, height: 1350, parts: [], wires: [] }, type, 0, 0).layout.parts[0].label;
    expect(label('ir_tx')).toBe('IR Transmitter');
    expect(label('ir_rx')).toBe('IR Receiver');
    expect(label('buzzer_active')).toBe('Buzzer 5V');
    expect(label('buzzer_passive')).toBe('Buzzer');
  });
});
