/**
 * Beef Cut Normalizer — Multi-language cut name → standard cutCode
 *
 * Maps names in English, Chinese, Spanish, Portuguese to a canonical
 * cutCode used across all data sources.
 */

export interface CutMapping {
  cutCode: string;
  nameEn: string;
  nameZh: string;
  nameEs: string;
  namePt: string;
  primal: string;
  subprimal?: string;
  impsCode?: string;
  hsCode?: string;
}

const CUT_MAPPINGS: CutMapping[] = [
  // Chuck
  { cutCode: 'CHUCK_ROLL', nameEn: 'Chuck Roll', nameZh: '卡劳', nameEs: 'Roll de chuck', namePt: 'Roll de chuck', primal: 'Chuck', subprimal: 'Chuck Roll', impsCode: '116A', hsCode: '0201.30' },
  { cutCode: 'CHUCK_EYE_ROLL', nameEn: 'Chuck Eye Roll', nameZh: '眼肉盖', nameEs: 'Roll de ojo de chuck', namePt: 'Roll de olho de chuck', primal: 'Chuck', subprimal: 'Chuck Eye Roll', impsCode: '116D' },
  { cutCode: 'BLADE', nameEn: 'Blade', nameZh: '板腱', nameEs: 'Palilla', namePt: 'Paleta', primal: 'Chuck', subprimal: 'Blade', impsCode: '1114A', hsCode: '0201.30' },
  { cutCode: 'CHUCK_TENDER', nameEn: 'Chuck Tender', nameZh: '黄瓜条', nameEs: 'Cogote tierno', namePt: 'Coxão mole', primal: 'Chuck', subprimal: 'Chuck Tender', impsCode: '116B' },
  { cutCode: 'CHUCK_SHORT_RIBS', nameEn: 'Chuck Short Ribs', nameZh: '牛小排', nameEs: 'Costillas cortas de chuck', namePt: 'Costela curta de chuck', primal: 'Chuck', subprimal: 'Chuck Short Ribs', impsCode: '130' },
  { cutCode: 'NECK_CHAIN', nameEn: 'Neck Chain', nameZh: '脖肉', nameEs: 'Cadena de cuello', namePt: 'Cadeia de pescoço', primal: 'Chuck', impsCode: '113' },
  { cutCode: 'UNDER_BLADE', nameEn: 'Under Blade', nameZh: '板腱底', nameEs: 'Bajo de paleta', namePt: 'Sobrecostela', primal: 'Chuck', impsCode: '1114D' },
  { cutCode: 'CHUCK_FLAP', nameEn: 'Chuck Flap', nameZh: '板腱边', nameEs: 'Filete de chuck', namePt: 'Maminha de chuck', primal: 'Chuck' },

  // Rib
  { cutCode: 'RIB_EYE_ROLL', nameEn: 'Ribeye Roll', nameZh: '眼肉', nameEs: 'Roll de ojo de costilla', namePt: 'Roll de contrafilé', primal: 'Rib', subprimal: 'Ribeye Roll', impsCode: '112A', hsCode: '0201.30' },
  { cutCode: 'RIB_EYE_LIP_ON', nameEn: 'Ribeye Lip-On', nameZh: '带盖眼肉', nameEs: 'Ojo de costilla con labio', namePt: 'Contrafilé com borda', primal: 'Rib', impsCode: '112D' },
  { cutCode: 'BACK_RIBS', nameEn: 'Back Ribs', nameZh: '牛仔骨', nameEs: 'Costillas traseras', namePt: 'Costela traseira', primal: 'Rib', impsCode: '121', hsCode: '0206.29' },
  { cutCode: 'RIB_FINGER', nameEn: 'Rib Finger Meat', nameZh: '肋条', nameEs: 'Carne de dedo de costilla', namePt: 'Carne de dedo de costela', primal: 'Rib', impsCode: '112F' },
  { cutCode: 'RIB_CAP', nameEn: 'Rib Cap / Spinalis', nameZh: '眼肉盖', nameEs: 'Tapita de costilla', namePt: 'Capa de contrafilé', primal: 'Rib', impsCode: '112E' },
  { cutCode: 'SHORT_RIBS', nameEn: 'Short Ribs', nameZh: '牛仔骨', nameEs: 'Costillas cortas', namePt: 'Costela curta', primal: 'Rib', impsCode: '123A', hsCode: '0201.30' },
  { cutCode: 'RIB_ROAST', nameEn: 'Rib Roast', nameZh: '肋排', nameEs: 'Asado de costilla', namePt: 'Assado de costela', primal: 'Rib', impsCode: '109' },

  // Loin
  { cutCode: 'STRIPLOIN', nameEn: 'Striploin', nameZh: '西冷', nameEs: 'Lomo corto', namePt: 'Contrafilé', primal: 'Loin', subprimal: 'Strip Loin', impsCode: '180', hsCode: '0201.30' },
  { cutCode: 'TENDERLOIN', nameEn: 'Tenderloin', nameZh: '菲力', nameEs: 'Solomillo', namePt: 'Filé mignon', primal: 'Loin', subprimal: 'Tenderloin', impsCode: '189A', hsCode: '0201.30' },
  { cutCode: 'TENDERLOIN_FULL', nameEn: 'Tenderloin Full', nameZh: '整条菲力', nameEs: 'Solomillo entero', namePt: 'Filé mignon inteiro', primal: 'Loin', impsCode: '189' },
  { cutCode: 'T_BONE', nameEn: 'T-Bone', nameZh: 'T骨', nameEs: 'T-bone', namePt: 'T-bone', primal: 'Loin', impsCode: '1174' },
  { cutCode: 'PORTERHOUSE', nameEn: 'Porterhouse', nameZh: '红屋牛排', nameEs: 'Porterhouse', namePt: 'Porterhouse', primal: 'Loin', impsCode: '1173' },
  { cutCode: 'SIRLOIN', nameEn: 'Sirloin / Rump Cover', nameZh: '沙朗', nameEs: 'Aguja', namePt: 'Picanha', primal: 'Loin', impsCode: '181A', hsCode: '0201.30' },
  { cutCode: 'TOP_SIRLOIN', nameEn: 'Top Sirloin Butt', nameZh: '上沙朗', nameEs: 'Solomillo superior', namePt: 'Ponta de agulha', primal: 'Loin', impsCode: '184' },
  { cutCode: 'BOTTOM_SIRLOIN', nameEn: 'Bottom Sirloin Butt', nameZh: '下沙朗', nameEs: 'Aguja inferior', namePt: 'Patinho', primal: 'Loin', impsCode: '185' },
  { cutCode: 'TRI_TIP', nameEn: 'Tri-Tip', nameZh: '三角肉', nameEs: 'Tri-tip', namePt: 'Maminha', primal: 'Loin', impsCode: '185C' },
  { cutCode: 'BALL_TIP', nameEn: 'Ball Tip', nameZh: '球形尖', nameEs: 'Punta de bola', namePt: 'Ponta de bola', primal: 'Loin', impsCode: '185B' },
  { cutCode: 'FLAP', nameEn: 'Flap Meat', nameZh: '裙肉', nameEs: 'Falda', namePt: 'Barriga', primal: 'Loin', impsCode: '185A', hsCode: '0201.30' },

  // Round
  { cutCode: 'TOPSIDE', nameEn: 'Topside', nameZh: '小米龙', nameEs: 'Cara interna', namePt: 'Lagarto', primal: 'Round', subprimal: 'Top (Inside) Round', impsCode: '169A', hsCode: '0201.30' },
  { cutCode: 'SILVERSIDE', nameEn: 'Silverside', nameZh: '大米龙', nameEs: 'Cara externa', namePt: 'Patinho', primal: 'Round', subprimal: 'Bottom (Gooseneck) Round', impsCode: '170', hsCode: '0201.30' },
  { cutCode: 'EYE_ROUND', nameEn: 'Eye of Round', nameZh: '牛脍', nameEs: 'Ojo de rueda', namePt: 'Lagarto olho', primal: 'Round', impsCode: '171C', hsCode: '0201.30' },
  { cutCode: 'KNUCKLE', nameEn: 'Knuckle', nameZh: '牛霖', nameEs: 'Carrillera trasera', namePt: 'Picanha do dianteiro', primal: 'Round', subprimal: 'Knuckle (Tip)', impsCode: '167A', hsCode: '0201.30' },
  { cutCode: 'OUTSIDE_FLAT', nameEn: 'Outside Flat', nameZh: '外股', nameEs: 'Plana', namePt: 'Chã de fora', primal: 'Round', impsCode: '171B' },
  { cutCode: 'HEEL_MUSCLE', nameEn: 'Heel Muscle', nameZh: '牛腱', nameEs: 'Músculo de talón', namePt: 'Músculo do calcanhar', primal: 'Round', impsCode: '171D' },
  { cutCode: 'RUMP', nameEn: 'Rump', nameZh: '牛臀肉', nameEs: 'Rump', namePt: 'Alcatra', primal: 'Round', impsCode: '158' },

  // Brisket
  { cutCode: 'BRISKET_POINT', nameEn: 'Brisket Point End', nameZh: '前胸', nameEs: 'Pecho punta', namePt: 'Peito ponta', primal: 'Brisket', subprimal: 'Brisket Point', impsCode: '120', hsCode: '0201.30' },
  { cutCode: 'BRISKET_NAVEL', nameEn: 'Brisket Navel End', nameZh: '牛腩', nameEs: 'Pecho ombligo', namePt: 'Peito umbigo', primal: 'Brisket', subprimal: 'Brisket Navel', impsCode: '121', hsCode: '0201.30' },
  { cutCode: 'BRISKET_NOSE', nameEn: 'Brisket Nose', nameZh: '牛胸鼻', nameEs: 'Pecho nariz', namePt: 'Peito nariz', primal: 'Brisket' },
  { cutCode: 'BRISKET_CORNED', nameEn: 'Corned Beef Brisket', nameZh: '咸牛胸', nameEs: 'Pecho curado', namePt: 'Peito curado', primal: 'Brisket' },

  // Shank
  { cutCode: 'FORESHANK', nameEn: 'Foreshank', nameZh: '牛前腱', nameEs: 'Jarrete delantero', namePt: 'Maminha dianteira', primal: 'Shank', impsCode: '129' },
  { cutCode: 'HINDSHANK', nameEn: 'Hindshank', nameZh: '牛后腱', nameEs: 'Jarrete trasero', namePt: 'Maminha traseira', primal: 'Shank', impsCode: '130' },
  { cutCode: 'SHANK_CROSS_CUT', nameEn: 'Shank Cross Cut / Osso Buco', nameZh: '牛腱块', nameEs: 'Jarrete cortado', namePt: 'Maminha cortada', primal: 'Shank' },

  // Plate / Flank
  { cutCode: 'OUTSIDE_SKIRT', nameEn: 'Outside Skirt', nameZh: '外裙', nameEs: 'Entraña exterior', namePt: 'Fraldinha externa', primal: 'Plate', impsCode: '121C', hsCode: '0201.30' },
  { cutCode: 'INSIDE_SKIRT', nameEn: 'Inside Skirt', nameZh: '内裙', nameEs: 'Entraña interior', namePt: 'Fraldinha interna', primal: 'Plate', impsCode: '121D', hsCode: '0201.30' },
  { cutCode: 'FLANK_STEAK', nameEn: 'Flank Steak', nameZh: ' flank肉', nameEs: 'Bife de falda', namePt: 'Bife de fraldinha', primal: 'Flank', impsCode: '193' },
  { cutCode: 'PLATE_SHORT_RIBS', nameEn: 'Plate Short Ribs', nameZh: '裙边牛排', nameEs: 'Costillas de plato', namePt: 'Costela do peito', primal: 'Plate', impsCode: '123A' },
  { cutCode: 'HANGING_TENDER', nameEn: 'Hanging Tender / Oyster Blade', nameZh: '吊龙', nameEs: 'Solomillo colgante', namePt: 'Filé pendente', primal: 'Plate', impsCode: '140' },

  // Offal
  { cutCode: 'TONGUE', nameEn: 'Ox Tongue', nameZh: '牛舌', nameEs: 'Lengua', namePt: 'Língua', primal: 'Offal', hsCode: '0206.10' },
  { cutCode: 'OX_TRIPE', nameEn: 'Ox Tripe', nameZh: '牛肚', nameEs: 'Callos', namePt: 'Bucho', primal: 'Offal', hsCode: '0206.29' },
  { cutCode: 'HONEYCOMB_TRIPE', nameEn: 'Honeycomb Tripe', nameZh: '百叶', nameEs: 'Callo panal', namePt: 'Papelote', primal: 'Offal', hsCode: '0206.29' },
  { cutCode: 'LIVER', nameEn: 'Beef Liver', nameZh: '牛肝', nameEs: 'Hígado', namePt: 'Fígado', primal: 'Offal', hsCode: '0206.10' },
  { cutCode: 'KIDNEY', nameEn: 'Beef Kidney', nameZh: '牛肾', nameEs: 'Riñón', namePt: 'Rim', primal: 'Offal', hsCode: '0206.10' },
  { cutCode: 'HEART', nameEn: 'Beef Heart', nameZh: '牛心', nameEs: 'Corazón', namePt: 'Coração', primal: 'Offal', hsCode: '0206.10' },
  { cutCode: 'TAIL', nameEn: 'Oxtail', nameZh: '牛尾', nameEs: 'Rabo de toro', namePt: 'Rabo', primal: 'Offal', hsCode: '0206.29' },
  { cutCode: 'MARROW', nameEn: 'Bone Marrow', nameZh: '牛骨髓', nameEs: 'Tuétano', namePt: 'Tutano', primal: 'Offal', hsCode: '0206.29' },
  { cutCode: 'SWEETBREAD', nameEn: 'Sweetbread / Thymus', nameZh: '牛胸腺', nameEs: 'Molleja', namePt: 'Timbo', primal: 'Offal' },
  { cutCode: 'AORTA', nameEn: 'Aorta', nameZh: '牛黄喉', nameEs: 'Aorta', namePt: 'Aorta', primal: 'Offal' },
  { cutCode: 'LUNG', nameEn: 'Beef Lung', nameZh: '牛肺', nameEs: 'Pulmón', namePt: 'Pulmão', primal: 'Offal' },
  { cutCode: 'FEET', nameEn: 'Beef Feet', nameZh: '牛蹄', nameEs: 'Patas', namePt: 'Patas', primal: 'Offal' },
  { cutCode: 'TENDON', nameEn: 'Beef Tendon', nameZh: '牛筋', nameEs: 'Tendón', namePt: 'Tendão', primal: 'Offal' },
  { cutCode: 'INTESTINE', nameEn: 'Beef Intestine', nameZh: '牛肠', nameEs: 'Intestino', namePt: 'Intestino', primal: 'Offal' },

  // Fat / Tallow
  { cutCode: 'KIDNEY_FAT', nameEn: 'Kidney Fat / Suet', nameZh: '板油', nameEs: 'Grasa de riñón', namePt: 'Gordura de rim', primal: 'Fat' },
  { cutCode: 'CAUL_FAT', nameEn: 'Caul Fat', nameZh: '网油', nameEs: 'Grasa de red', namePt: 'Gordura de rede', primal: 'Fat' },
  { cutCode: 'CLIPPING_FAT', nameEn: 'Clipping Fat', nameZh: '碎油', nameEs: 'Grasa de recorte', namePt: 'Gordura de aparas', primal: 'Fat' },

  // Whole / Carcass
  { cutCode: 'WHOLE_CARCASS', nameEn: 'Whole Carcass', nameZh: '整牛', nameEs: 'Canal entera', namePt: 'Carcaça inteira', primal: 'Carcass' },
  { cutCode: 'HALF_CARCASS', nameEn: 'Half Carcass', nameZh: '半胴体', nameEs: 'Media canal', namePt: 'Meia carcaça', primal: 'Carcass' },
  { cutCode: 'QUARTER_FRONT', nameEn: 'Front Quarter', nameZh: '前四分体', nameEs: 'Cuarto delantero', namePt: 'Dianteiro', primal: 'Carcass' },
  { cutCode: 'QUARTER_HIND', nameEn: 'Hind Quarter', nameZh: '后四分体', nameEs: 'Cuarto trasero', namePt: 'Traseiro', primal: 'Carcass' },

  // Manufacturing / Grinding
  { cutCode: 'LEAN_TRIM_90', nameEn: 'Lean Trim 90CL', nameZh: '精瘦肉90', nameEs: 'Recorte magro 90CL', namePt: 'Apara magra 90CL', primal: 'Manufacturing' },
  { cutCode: 'LEAN_TRIM_85', nameEn: 'Lean Trim 85CL', nameZh: '精瘦肉85', nameEs: 'Recorte magro 85CL', namePt: 'Apara magra 85CL', primal: 'Manufacturing' },
  { cutCode: 'LEAN_TRIM_80', nameEn: 'Lean Trim 80CL', nameZh: '精瘦肉80', nameEs: 'Recorte magro 80CL', namePt: 'Apara magra 80CL', primal: 'Manufacturing' },
  { cutCode: 'LEAN_TRIM_75', nameEn: 'Lean Trim 75CL', nameZh: '精瘦肉75', nameEs: 'Recorte magro 75CL', namePt: 'Apara magra 75CL', primal: 'Manufacturing' },
  { cutCode: 'LEAN_TRIM_73', nameEn: 'Lean Trim 73CL', nameZh: '精瘦肉73', nameEs: 'Recorte magro 73CL', namePt: 'Apara magra 73CL', primal: 'Manufacturing' },
  { cutCode: 'LEAN_TRIM_50', nameEn: 'Lean Trim 50CL', nameZh: '精瘦肉50', nameEs: 'Recorte magro 50CL', namePt: 'Apara magra 50CL', primal: 'Manufacturing' },

  // Sausage / Processing
  { cutCode: 'SAUSAGE_CASING', nameEn: 'Natural Casing', nameZh: '天然肠衣', nameEs: 'Tripa natural', namePt: 'Tripa natural', primal: 'Processing' },
  { cutCode: 'BEEF_MINCE', nameEn: 'Beef Mince / Ground Beef', nameZh: '牛肉馅', nameEs: 'Carne picada', namePt: 'Carne moída', primal: 'Processing' },
];

// Build lookup maps for O(1) resolution
const nameToCode = new Map<string, string>();

for (const cut of CUT_MAPPINGS) {
  const names = [cut.nameEn, cut.nameZh, cut.nameEs, cut.namePt].filter(Boolean) as string[];
  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (!nameToCode.has(key)) {
      nameToCode.set(key, cut.cutCode);
    }
  }
}

// Common aliases that don't fit in the structured data
const ALIASES: Record<string, string> = {
  // Chinese aliases
  '肥牛': 'BRISKET_NAVEL',
  '牛排': 'STRIPLOIN',
  '肥牛卷': 'BRISKET_NAVEL',
  '牛肉粒': 'BEEF_MINCE',
  '牛碎肉': 'LEAN_TRIM_80',
  '胸肉': 'BRISKET_POINT',
  '前腿': 'FORESHANK',
  '后腿': 'HINDSHANK',
  '牛尾': 'TAIL',
  '金钱腱': 'FORESHANK',
  '腱子肉': 'FORESHANK',
  '牛骨髓': 'MARROW',

  // English aliases
  'cube roll': 'RIB_EYE_ROLL',
  'scotch fillet': 'RIB_EYE_ROLL',
  'filet mignon': 'TENDERLOIN',
  'ny strip': 'STRIPLOIN',
  'new york strip': 'STRIPLOIN',
  'kc strip': 'STRIPLOIN',
  'top round': 'TOPSIDE',
  'bottom round': 'SILVERSIDE',
  'inside round': 'TOPSIDE',
  'outside round': 'OUTSIDE_FLAT',
  'gooseneck round': 'SILVERSIDE',
  'oyster blade': 'BLADE',
  'flat iron': 'BLADE',
  'denver cut': 'CHUCK_FLAP',
  'ranch steak': 'CHUCK_ROLL',
  'delmonico': 'RIB_EYE_ROLL',
  'spencer steak': 'RIB_EYE_ROLL',
  'beef cheek': 'OFFAL',
  'ground beef': 'BEEF_MINCE',
  'minced beef': 'BEEF_MINCE',
  'diced beef': 'BEEF_MINCE',
  'stewing beef': 'BEEF_MINCE',
  'trimmings': 'LEAN_TRIM_80',
  'trim': 'LEAN_TRIM_80',
  'fats': 'CLIPPING_FAT',
  'tallow': 'CLIPPING_FAT',
  'cl': 'LEAN_TRIM_80',

  // Spanish aliases
  'bife de chorizo': 'STRIPLOIN',
  'bife ancho': 'RIB_EYE_ROLL',
  'entraña': 'OUTSIDE_SKIRT',
  'vacío': 'FLAP',
  'matambre': 'FLANK_STEAK',
  'asado de tira': 'SHORT_RIBS',

  // Portuguese aliases
  'contrafilé': 'STRIPLOIN',
  'alcatra': 'RUMP',
  'picanha': 'SIRLOIN',
  'maminha': 'FLAP',
  'fraldinha': 'FLANK_STEAK',
  'lagarto': 'TOPSIDE',
  'patinho': 'BOTTOM_SIRLOIN',
  'coxão duro': 'OUTSIDE_FLAT',
  'coxão mole': 'TOPSIDE',
};

// Add aliases to the lookup
for (const [alias, code] of Object.entries(ALIASES)) {
  const key = alias.toLowerCase().trim();
  if (!nameToCode.has(key)) {
    nameToCode.set(key, code);
  }
}

/**
 * Normalize a cut name from any language to a standard cutCode.
 * Returns null if no match found.
 */
export function normalizeBeefCut(name: string): string | null {
  const key = name.toLowerCase().trim();

  // Exact match
  if (nameToCode.has(key)) {
    return nameToCode.get(key)!;
  }

  // Try with common suffixes/prefixes stripped
  const stripped = key
    .replace(/^(beef|bovine|de|do|da|the)\s+/i, '')
    .replace(/\s+(meat|cut|steak|roast|boneless|bone-in|trimmed|untrimmed)$/i, '')
    .trim();

  if (nameToCode.has(stripped)) {
    return nameToCode.get(stripped)!;
  }

  // Fuzzy: check if any key contains the input or vice versa
  for (const [mapKey, code] of nameToCode) {
    if (mapKey.includes(key) || key.includes(mapKey)) {
      return code;
    }
  }

  return null;
}

/**
 * Get all cut mappings (for seed data).
 */
export function getAllCutMappings(): CutMapping[] {
  return [...CUT_MAPPINGS];
}

/**
 * Get a specific cut mapping by cutCode.
 */
export function getCutMapping(cutCode: string): CutMapping | undefined {
  return CUT_MAPPINGS.find(c => c.cutCode === cutCode);
}
