import { flatChecklistItems } from '../data/checklistItems.js'
import { COPY_SLOTS, normalizeAssessmentItems } from './assessmentCopies.js'

const statusLabels = { yes: 'Yes', no: 'No', na: 'N/A' }
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]))

function attachmentLines(item, state) {
  if (state.status === 'na') return []
  if (item.marker === 'copies') {
    return (state.assessmentInstances ?? []).flatMap((instance) => (
      COPY_SLOTS.flatMap((slot) => {
        const attachment = instance.attachments?.[slot.id]
        return attachment
          ? [`<li><strong>${escapeHtml(instance.label)}</strong> — ${escapeHtml(slot.label)}: ${escapeHtml(attachment.name)}</li>`]
          : []
      })
    ))
  }
  const attachments = Array.isArray(state.attachments) ? state.attachments : state.attachment ? [state.attachment] : []
  return attachments.filter(Boolean).map((attachment) => `<li>${escapeHtml(attachment.name)}</li>`)
}

export function buildChecklistPrintHtml(record) {
  const items = normalizeAssessmentItems(record.items ?? {})
  const rows = flatChecklistItems.map((item) => {
    const state = items[item.id] ?? {}
    const attachments = attachmentLines(item, state)
    return `<tr><td>${escapeHtml(item.order)}</td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(statusLabels[state.status] ?? '—')}</td><td>${attachments.length ? `<ul>${attachments.join('')}</ul>` : '—'}</td><td class="comments">${escapeHtml(state.comments || '—')}</td></tr>`
  }).join('')
  const footer = record.footer ?? {}
  const date = record.submittedAt ?? record.updatedAt ?? new Date().toISOString()
  const feedback = [
    ['Reviewer comments', footer.reviewerComments],
    ['Additional notes', footer.additionalNotes],
    ['Admin feedback', record.adminFeedback ?? footer.adminFeedback],
    ['Admin comments', record.adminComments ?? footer.adminComments],
  ]
  const footerRows = feedback.map(([label, value]) => (
    `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || '—')}</p>`
  )).join('')
  const header = record.header ?? {}

  return `<!doctype html><html><head><meta charset="utf-8"><title>AQAT Checklist ${escapeHtml(header.subjectCode)}</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#172033}h1{margin-bottom:4px}.meta{color:#475569;margin:4px 0 24px}
    table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #cbd5e1;text-align:left;vertical-align:top}
    td ul{margin:0;padding-left:18px}td li{margin-bottom:3px}.comments{white-space:pre-wrap}
    .footer-notes{margin-top:24px}.footer-notes p{white-space:pre-wrap}
    @media print{tr{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}}
  </style></head><body><h1>AQAT Subject File Checklist</h1>
    <p class="meta"><strong>Subject code:</strong> ${escapeHtml(header.subjectCode || '—')} &nbsp; <strong>Subject:</strong> ${escapeHtml(header.subjectName || '—')}</p>
    <p class="meta"><strong>Lecturer:</strong> ${escapeHtml(header.staffName || '—')} &nbsp; <strong>Department:</strong> ${escapeHtml(header.department || '—')} &nbsp; <strong>Date:</strong> ${escapeHtml(new Date(date).toLocaleDateString())}</p>
    <table><thead><tr><th>#</th><th>Criterion</th><th>Status</th><th>Attachments by assessment instance</th><th>Comments</th></tr></thead><tbody>${rows}</tbody></table>
    <section class="footer-notes"><h2>Comments and feedback</h2>${footerRows}</section>
  </body></html>`
}

export function printChecklistSummary(record) {
  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) return
  printWindow.document.open()
  printWindow.document.write(buildChecklistPrintHtml(record))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
