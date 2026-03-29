export type SurroundingCategory = {
  id: 'medicalFacilities' | 'lifeFacilities' | 'educationFacilities';
  label: string;
  icon: string;
  subsections: string[];
};

export const surroundingCategories: SurroundingCategory[] = [
  {
    id: 'lifeFacilities',
    label: '生活',
    icon: '🏘️',
    subsections: ['公共', '金融機関', '郵便局'],
  },
  {
    id: 'educationFacilities',
    label: '教育',
    icon: '🏫',
    subsections: ['幼児教育', '教育（初等）', '教育（中等）', '教育（高等）'],
  },
  {
    id: 'medicalFacilities',
    label: '医療',
    icon: '🏥',
    subsections: ['総合病院', '医療（診療所）', '薬局', '動物病院'],
  },
];
