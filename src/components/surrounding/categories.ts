export type SurroundingCategory = {
  id: string;
  label: string;
  icon: string;
  color: string;
  subsections: string[];
};

export const surroundingCategories: SurroundingCategory[] = [
  {
    id: 'lifeFacilities',
    label: '生活',
    icon: '🏘️',
    color: 'blue',
    subsections: ['公共', '金融機関', '郵便局'],
  },
  {
    id: 'educationFacilities',
    label: '教育',
    icon: '🏫',
    color: 'green',
    subsections: ['幼児教育', '教育（初等）', '教育（中等）', '教育（高等）'],
  },
  {
    id: 'medicalFacilities',
    label: '医療',
    icon: '🏥',
    color: 'red',
    subsections: [
      '総合病院',
      '医療（診療所）',
      '薬局',
      'ドラッグストア',
      '動物病院',
    ],
  },
  {
    id: 'parkFacilities',
    label: '公園',
    icon: '🌳',
    color: 'emerald',
    subsections: ['公園'],
  },
];
