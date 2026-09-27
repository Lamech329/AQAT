export const checklistItems = [
  { id: '1', order: '1', label: 'Lecture Plan', marker: null },
  { id: '2', order: '2', label: 'Lecture note (# of 13 weeks)', marker: null },
  { id: '3', order: '3', label: 'Tutorials (if compulsory only)', marker: null },
  { id: '4', order: '4', label: 'Assignments with solutions & 3 marked copies', marker: 'copies' },
  { id: '5', order: '5', label: 'Laboratory assignments with 3 marked copies', marker: 'copies' },
  { id: '6', order: '6', label: 'Quizzes with solutions & 3 marked copies', marker: 'copies' },
  { id: '7', order: '7', label: 'Tests with solutions & 3 marked copies', marker: 'copies' },
  { id: '8', order: '8', label: 'Student evaluation summary of teachers', marker: 'ifAvailable' },
  { id: '9', order: '9', label: 'Final exam Question Paper with solution & 3 copies of marked exam scripts', marker: 'copies' },
  { id: '10', order: '10', label: 'Copy of final exam moderation sheet', marker: 'ifAvailable' },
  { id: '11', order: '11', label: "Examiner's report", marker: 'ifAvailable' },
  { id: '12', order: '12', label: 'Annual review of the subject', marker: 'ifAvailable' },
  {
    id: '13',
    order: '13',
    label: 'Continuous assessment with break up',
    marker: 'excel',
    children: [
      { id: '13a', order: '13a', label: 'Laboratory Att % or G Class checklist & Exam', marker: null },
      { id: '13b', order: '13b', label: 'CA + final exam marks and Grade', marker: 'excel' },
    ],
  },
]

export const flatChecklistItems = checklistItems.flatMap((item) => [
  item,
  ...(item.children ?? []),
])

export const markerLabels = {
  copies: '3 copies required',
  ifAvailable: 'if available',
  excel: 'Excel file',
}
