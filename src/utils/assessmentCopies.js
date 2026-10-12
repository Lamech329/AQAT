import { flatChecklistItems } from '../data/checklistItems.js'

export const COPY_SLOTS = [
  { id: 'question_paper', label: 'Question paper' },
  { id: 'lowest', label: 'Lowest mark' },
  { id: 'median', label: 'Median mark' },
  { id: 'highest', label: 'Highest mark' },
]

export const MARKED_ASSESSMENTS = flatChecklistItems.filter((item) => item.marker === 'copies')

const assessmentNames = {
  4: 'Assignment',
  5: 'Lab assignment',
  6: 'Quiz',
  7: 'Test',
  9: 'Final exam',
}

export const getAssessmentName = (assessmentId) => assessmentNames[assessmentId] ?? 'Assessment'

export function createAssessmentInstance(assessmentId, number) {
  const id = `instance-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
  return {
    id,
    label: `${getAssessmentName(assessmentId)} ${number}`,
    attachments: Object.fromEntries(COPY_SLOTS.map(({ id: slotId }) => [slotId, null])),
  }
}

export function normalizeLegacyAttachmentList(value = []) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (!value) return []
  return [value]
}

export function normalizeRegularItem(item = {}) {
  if (!item || typeof item !== 'object') return item
  if (Array.isArray(item.assessmentInstances) || item.marker === 'copies') return item

  const attachments = normalizeLegacyAttachmentList(Array.isArray(item.attachments) ? item.attachments : item.attachment)
  return {
    ...item,
    attachments,
    attachment: attachments[0] ?? null,
  }
}

export function normalizeChecklistState(items = {}) {
  return Object.fromEntries(Object.entries(items ?? {}).map(([id, item]) => [id, normalizeRegularItem(item)]))
}

export function getRegularAttachmentList(item = {}) {
  if (!item || typeof item !== 'object') return []
  if (Array.isArray(item.attachments)) return item.attachments.filter(Boolean)
  if (item.attachment) return [item.attachment]
  return []
}

export function getCriterionFiles(item = {}) {
  const regular = getRegularAttachmentList(item)
  const marked = (item.assessmentInstances ?? []).flatMap((instance) => Object.values(instance.attachments ?? {}).filter(Boolean))
  return [...regular, ...marked]
}

export function clearCriterionFiles(item = {}) {
  return {
    ...item,
    attachment: null,
    attachments: [],
    assessmentInstances: (item.assessmentInstances ?? []).map((instance) => ({
      ...instance,
      attachments: Object.fromEntries(COPY_SLOTS.map(({ id }) => [id, null])),
    })),
  }
}

export function normalizeAssessmentItems(items = {}) {
  const normalized = { ...items }

  MARKED_ASSESSMENTS.forEach((assessment) => {
    const item = normalized[assessment.id] ?? {}
    if (Array.isArray(item.assessmentInstances)) {
      normalized[assessment.id] = {
        ...item,
        assessmentInstances: item.assessmentInstances.map((instance) => ({
          ...instance,
          attachments: Object.fromEntries(COPY_SLOTS.map(({ id }) => [id, instance.attachments?.[id] ?? null])),
        })),
      }
      return
    }

    const attachments = item.attachments ?? {}
    normalized[assessment.id] = {
      ...item,
      assessmentInstances: [{
        id: 'instance-1',
        label: `${getAssessmentName(assessment.id)} 1`,
        attachments: Object.fromEntries(COPY_SLOTS.map(({ id }) => [id, attachments[id] ?? null])),
      }],
    }
  })

  return normalizeChecklistState(normalized)
}

export function getMissingCopySlots(itemState = {}) {
  const normalized = normalizeAssessmentItems(itemState)

  return MARKED_ASSESSMENTS.flatMap((assessment) => {
    if (normalized[assessment.id]?.status === 'na') return []

    const instances = normalized[assessment.id]?.assessmentInstances ?? []
    if (instances.length === 0) {
      return [{
        assessmentId: assessment.id,
        assessmentLabel: assessment.label,
        assessmentInstanceId: null,
        assessmentInstanceLabel: '',
        label: 'at least one assessment instance required',
        slotId: null,
      }]
    }

    return instances.flatMap((instance) => (
      COPY_SLOTS
        .filter(({ id }) => !instance.attachments?.[id])
        .map((slot) => ({
          assessmentId: assessment.id,
          assessmentLabel: assessment.label,
          assessmentInstanceId: instance.id,
          assessmentInstanceLabel: instance.label,
          ...slot,
          slotId: slot.id,
        }))
    ))
  })
}

export function getMissingChecklistRequirements(itemState = {}, header = {}) {
  const groups = []
  const missingHeader = [
    ['department', 'Department'],
    ['staffName', 'Lecturer'],
    ['subjectName', 'Subject name'],
    ['subjectCode', 'Subject code'],
    ['semester', 'Semester'],
    ['year', 'Year'],
  ].filter(([key]) => !String(header[key] ?? '').trim())
    .map(([, label]) => `${label}: missing`)

  if (missingHeader.length) groups.push({ id: 'header', label: 'Subject details', missing: missingHeader })

  const missingCopies = getMissingCopySlots(itemState)
  flatChecklistItems.forEach((item) => {
    const state = itemState[item.id] ?? {}
    const missing = []
    if (!state.status) missing.push('status not set')
    if (item.marker === 'copies' && state.status !== 'na') {
      missingCopies
        .filter(({ assessmentId }) => assessmentId === item.id)
        .forEach((copy) => {
          missing.push(copy.assessmentInstanceId
          ? `${copy.assessmentInstanceLabel}: ${copy.slotId === 'question_paper' ? 'question paper missing' : `${copy.label.replace(/ mark$/, '').toLowerCase()} copy missing`}`
            : copy.label)
        })
    }
    if (missing.length) groups.push({ id: item.id, label: `${item.order}. ${item.label}`, missing })
  })

  return groups
}

export function getCopyProgress(instance = {}) {
  const uploaded = COPY_SLOTS.filter(({ id }) => instance.attachments?.[id]).length
  return { uploaded, required: COPY_SLOTS.length }
}
