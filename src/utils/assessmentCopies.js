import { flatChecklistItems } from '../data/checklistItems.js'

export const COPY_SLOTS = [
  { id: 'lowest', label: 'Lowest mark' },
  { id: 'median', label: 'Median mark' },
  { id: 'highest', label: 'Highest mark' },
]

export const MARKED_ASSESSMENTS = flatChecklistItems.filter((item) => item.marker === 'copies')

export function getMissingCopySlots(itemState = {}) {
  return MARKED_ASSESSMENTS.flatMap((assessment) => (
    COPY_SLOTS
      .filter(({ id }) => !itemState[assessment.id]?.attachments?.[id])
      .map((slot) => ({ assessmentId: assessment.id, assessmentLabel: assessment.label, ...slot }))
  ))
}

export function getCopyProgress(itemState = {}, assessmentId) {
  const uploaded = COPY_SLOTS.filter(({ id }) => itemState[assessmentId]?.attachments?.[id]).length
  return { uploaded, required: COPY_SLOTS.length }
}
