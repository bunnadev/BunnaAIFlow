/** Tên tiếng Việt + nhóm của linh kiện có sẵn, để hiện trong thư viện Xưởng vẽ. */

export interface LibraryItem { type: string; name: string; group: string; idBase?: string }

export const LIBRARY_GROUPS = ['Cơ bản', 'Bán dẫn / IC', 'Nguồn & đầu nối', 'Pin & máy nguồn', 'Của tôi'];

export const BUILTIN_LIBRARY: LibraryItem[] = [
  { type: 'resistor', name: 'Điện trở', group: 'Cơ bản' },
  { type: 'led', name: 'LED', group: 'Cơ bản' },
  { type: 'cap_elec', name: 'Tụ hoá', group: 'Cơ bản' },
  { type: 'cap_ceramic', name: 'Tụ gốm', group: 'Cơ bản' },
  { type: 'diode', name: 'Diode', group: 'Cơ bản' },
  { type: 'pot', name: 'Chiết áp', group: 'Cơ bản' },
  { type: 'to92', name: 'Transistor TO-92', group: 'Bán dẫn / IC' },
  { type: 'to220', name: 'TO-220', group: 'Bán dẫn / IC' },
  { type: 'to3', name: 'Sò TO-3', group: 'Bán dẫn / IC' },
  { type: 'pentawatt', name: 'IC Pentawatt', group: 'Bán dẫn / IC' },
  { type: 'dip8', name: 'IC 8 chân', group: 'Bán dẫn / IC' },
  { type: 'dip14', name: 'IC 14 chân', group: 'Bán dẫn / IC' },
  { type: 'dip16', name: 'IC 16 chân', group: 'Bán dẫn / IC' },
  { type: 'terminal2', name: 'Cọc nguồn', group: 'Nguồn & đầu nối' },
  { type: 'bus', name: 'Thanh mass', group: 'Nguồn & đầu nối', idBase: 'GND' },
  { type: 'bus', name: 'Thanh nguồn +', group: 'Nguồn & đầu nối', idBase: 'VCC' },
  { type: 'lead', name: 'Đầu dây tự do', group: 'Nguồn & đầu nối' },
  { type: 'jack35', name: 'Jack 3.5mm', group: 'Nguồn & đầu nối' },
  { type: 'mic', name: 'Micro', group: 'Nguồn & đầu nối' },
  { type: 'speaker', name: 'Loa', group: 'Nguồn & đầu nối' },
  { type: 'psu', name: 'Máy cấp nguồn', group: 'Pin & máy nguồn' },
  { type: 'cell_aa', name: 'Pin AA', group: 'Pin & máy nguồn' },
  { type: 'cell_aaa', name: 'Pin AAA', group: 'Pin & máy nguồn' },
  { type: 'cell_18650', name: 'Pin 18650', group: 'Pin & máy nguồn' },
  { type: 'bh_aa_2', name: 'Đế pin AA', group: 'Pin & máy nguồn' },
  { type: 'bh_aaa_2', name: 'Đế pin AAA', group: 'Pin & máy nguồn' },
  { type: 'bh_18650_2', name: 'Đế pin 18650', group: 'Pin & máy nguồn' },
];
