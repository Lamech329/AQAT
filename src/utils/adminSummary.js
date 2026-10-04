import { flatChecklistItems } from '../data/checklistItems.js'
import { COPY_SLOTS, getMissingCopySlots } from './assessmentCopies.js'

function missingRequirements(record) {
  const missingItems = flatChecklistItems
    .filter((item) => !record.items?.[item.id]?.status)
    .map((item) => `${item.order}. ${item.label} (status unresolved)`)
  const missingCopies = getMissingCopySlots(record.items ?? {})
    .map(({ assessmentLabel, label }) => `${assessmentLabel}: ${label} copy`)
  return [...missingItems, ...missingCopies]
}

export function summarizeAdminRecords(records) {
  const submittedRecords = records.filter((record) => record.status === 'submitted')
  const incompleteSubmissions = submittedRecords
    .map((record) => ({ record, missing: missingRequirements(record) }))
    .filter(({ missing }) => missing.length > 0)
  const departmentMap = new Map()

  records.forEach((record) => {
    const department = record.header?.department
    if (!department) return
    const counts = departmentMap.get(department) ?? { name: department, total: 0, submitted: 0 }
    counts.total += 1
    if (record.status === 'submitted') counts.submitted += 1
    departmentMap.set(department, counts)
  })

  return {
    total: records.length,
    drafts: records.length - submittedRecords.length,
    submitted: submittedRecords.length,
    coveragePercent: records.length ? Math.round((submittedRecords.length / records.length) * 100) : 0,
    latestSubmissions: submittedRecords
      .slice()
      .sort((first, second) => String(second.submittedAt ?? '').localeCompare(String(first.submittedAt ?? '')))
      .slice(0, 5),
    incompleteSubmissions,
    departments: [...departmentMap.values()].sort((first, second) => first.name.localeCompare(second.name)),
    requiredCopySlots: COPY_SLOTS.length,
  }
}
