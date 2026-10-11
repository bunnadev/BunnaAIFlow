import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { routeWorld } from '../world';
import { renderExportSvg, subsetLayout } from '../exportImage';
import { DEFAULT_EXPORT_BACKGROUND } from '../projectModel';

const l: CircuitLayout = {
  parts: [
    { id: 'R1', type: 'resistor', x: 0, y: 0, value: '1k', label: '1kΩ' },
    { id: 'LED1', type: 'led', x: 300, y: 150 },
    { id: 'R2', type: 'resistor', x: 2000, y: 0, value: '220' },
  ],
  wires: [
    { from: 'R1.2', to: 'LED1.A', color: 'yellow' },
    { from: 'LED1.K', to: 'R2.1', color: 'pink' },
  ],
};
const routed = routeWorld(l);
const wood = { kind: 'wood' } as const;

describe('exportImage', () => {
  it('nền mặc định khi xuất là ảnh gỗ đen (khác ảnh ván gỗ cũ)', () => {
    expect(DEFAULT_EXPORT_BACKGROUND).toEqual({ kind: 'blackWood' });
    const black = renderExportSvg(l, routed, { aspect: '4:5', background: DEFAULT_EXPORT_BACKGROUND })!.svg;
    const planks = renderExportSvg(l, routed, { aspect: '4:5', background: wood })!.svg;
    expect(black).toMatch(/<image href="data:image\/jpeg;base64,[^"]+" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"\/>/);
    expect(planks).not.toContain('data:image/jpeg');
  });

  it('subsetLayout giữ dây có cả 2 đầu trong phần chọn', () => {
    const s = subsetLayout(l, ['R1', 'LED1']);
    expect(s.layout.parts.map((p) => p.id)).toEqual(['R1', 'LED1']);
    expect(s.wireIndex).toEqual([0]);
  });

  it('ký hiệu linh kiện chỉ in khi bật showIds', () => {
    const off = renderExportSvg(l, routed, { aspect: '4:5', background: wood })!.svg;
    const on = renderExportSvg(l, routed, { aspect: '4:5', background: wood, showIds: true })!.svg;
    expect(off).not.toMatch(/>LED1<\/text>/);
    expect(on).toMatch(/>R1<\/text>/);
    expect(on).toMatch(/>LED1<\/text>/);
    expect(on).toMatch(/>R2<\/text>/);
  });

  it('watermark: trống thì không in; góc / chéo giữa / cả hai', () => {
    const none = renderExportSvg(l, routed, { aspect: '4:5', background: wood, watermark: '  ' })!.svg;
    expect(none).not.toMatch(/fill-opacity="0.85"/);
    const corner = renderExportSvg(l, routed, { aspect: '4:5', background: wood, watermark: '@kenh<A>' })!.svg;
    expect(corner).toMatch(/text-anchor="end"[^>]*>@kenh&lt;A&gt;<\/text>/);
    expect(corner).not.toMatch(/rotate\(-50/);
    const center = renderExportSvg(l, routed, { aspect: '4:5', background: wood, watermark: '@kenh', watermarkPos: 'center' })!.svg;
    expect(center).toMatch(/rotate\(-50[^>]*>@kenh<\/text>/);
    expect(center).not.toMatch(/text-anchor="end"[^>]*>@kenh/);
    const both = renderExportSvg(l, routed, { aspect: '4:5', background: wood, watermark: '@kenh', watermarkPos: 'both' })!.svg;
    expect(both.match(/>@kenh<\/text>/g)).toHaveLength(2);
  });

  it('watermark góc đẩy tiêu đề dưới lên, không đè nhau', () => {
    const base = { aspect: '4:5' as const, background: wood, titleBottom: 'DUOI' };
    expect(renderExportSvg(l, routed, base)!.svg).toMatch(/y="1310"[^>]*>DUOI</);
    expect(renderExportSvg(l, routed, { ...base, watermark: '@kenh' })!.svg).toMatch(/y="1270"[^>]*>DUOI</);
  });

  it('kích thước theo khung', () => {
    expect(renderExportSvg(l, routed, { aspect: '4:5', background: wood })).toMatchObject({ width: 1080, height: 1350 });
    expect(renderExportSvg(l, routed, { aspect: '1:1', background: wood })!.height).toBe(1080);
    expect(renderExportSvg(l, routed, { aspect: '9:16', background: wood })!.height).toBe(1920);
  });

  it('xuất phần đang chọn bỏ dây ra ngoài; mạch nhỏ phóng to tối đa 1,5 lần', () => {
    const all = renderExportSvg(l, routed, { aspect: '4:5', background: wood })!;
    expect(all.svg).toContain('#f06aa8'); // dây hồng
    const sel = renderExportSvg(l, routed, { aspect: '4:5', background: wood, ids: ['R1', 'LED1'] })!;
    expect(sel.svg).not.toContain('#f06aa8');
    expect(sel.svg).toContain('#f5cf1d'); // dây vàng
    expect(renderExportSvg(l, routed, { aspect: '4:5', background: wood, ids: ['R1'] })!.scale).toBe(1.5);
    expect(all.scale).toBeLessThan(1);
  });

  it('nền gỗ / màu / ảnh, tiêu đề, phần chọn rỗng', () => {
    // nền gỗ = ảnh ván gỗ thật nhúng dạng data URL, phủ kín khung (cắt, không méo)
    const woodSvg = renderExportSvg(l, routed, { aspect: '4:5', background: wood })!.svg;
    expect(woodSvg).toMatch(/<image href="data:image\/webp;base64,[^"]+" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"\/>/);
    const color = renderExportSvg(l, routed, { aspect: '4:5', background: { kind: 'color', color: '#ffffff' } })!.svg;
    expect(color).toContain('fill="#ffffff"');
    expect(color).not.toContain('data:image/webp');
    const img = renderExportSvg(l, routed, { aspect: '4:5', background: { kind: 'image', id: 'a' }, backgroundDataUrl: 'data:image/png;base64,QQ==' })!.svg;
    expect(img).toContain('href="data:image/png;base64,QQ=="');
    expect(renderExportSvg(l, routed, { aspect: '4:5', background: wood, titleTop: 'ABC' })!.svg).toContain('>ABC</text>');
    expect(renderExportSvg(l, routed, { aspect: '4:5', background: wood, ids: [] })).toBeNull();
  });
});

describe('nền node "Vẽ mạch"', () => {
  it('app truyền nền ảnh gỗ (có tối 4 góc); không truyền thì vẫn là gỗ vẽ bằng code', async () => {
    const { renderCircuitSvg } = await import('../render');
    const { woodPhotoBackground } = await import('../woodPhoto');
    const lay = { parts: [{ id: 'R1', type: 'resistor', x: 540, y: 600 }], wires: [] };
    const photo = renderCircuitSvg(lay, { background: (W, H) => woodPhotoBackground(W, H, true) });
    expect(photo).toMatch(/<image href="data:image\/webp;base64,[^"]+" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"\/><rect width="1080" height="1350" fill="url\(#gVignette\)"\/>/);
    expect(photo).not.toContain('fill="url(#gWood)"');
    expect(renderCircuitSvg(lay)).toContain('fill="url(#gWood)"');
  });
});
