import { markerLabels } from '../data/checklistItems'
import { ThemeToggle } from './ThemeToggle'
import { SettingsButton } from './SettingsPanel'

const statusLabels = { yes: 'Yes', no: 'No', na: 'N/A' }

export function Summary({ header, items, itemState, footer, submittedAt, onPrint, onEdit, onDashboard, theme, onThemeToggle, onSettingsOpen }) {
  return (
    <main className="app-shell summary-view">
      <section className="summary-paper">
        <div className="summary-topline">
          <div>
            <p className="eyebrow">PNG University of Technology</p>
            <h1>AQAT Subject File Checklist</h1>
          </div>
          <div className="summary-actions">
            <span className="submitted-badge">Submitted on {new Date(submittedAt).toLocaleDateString()}</span>
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            <SettingsButton onClick={onSettingsOpen} />
          </div>
        </div>
        <dl className="summary-details">
          <div><dt>Department</dt><dd>{header.department}</dd></div>
          <div><dt>Name of Staff</dt><dd>{header.staffName}</dd></div>
          <div><dt>Subject Name</dt><dd>{header.subjectName}</dd></div>
          <div><dt>Subject Code</dt><dd>{header.subjectCode}</dd></div>
          <div><dt>Semester</dt><dd>{header.semester}</dd></div>
          <div><dt>Year</dt><dd>{header.year}</dd></div>
        </dl>
        <table>
          <thead><tr><th>#</th><th>Required document</th><th>Status</th><th>Attachment / comments</th></tr></thead>
          <tbody>
            {items.map((item) => {
              const state = itemState[item.id] ?? {}
              return (
                <tr key={item.id} className={item.order.length > 2 ? 'summary-sub-item' : ''}>
                  <td>{item.order}</td>
                  <td>{item.label} {item.marker && <em>({markerLabels[item.marker]})</em>}</td>
                  <td className={`summary-status status-${state.status || 'none'}`}>{statusLabels[state.status] ?? '—'}</td>
                  <td>{[state.attachment?.name, state.comments].filter(Boolean).join(' — ') || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="summary-notes">
          <p><strong>Reviewer Comments:</strong> {footer.reviewerComments || '—'}</p>
          <p><strong>Additional Notes:</strong> {footer.additionalNotes || '—'}</p>
        </div>
      </section>
      <div className="summary-footer-actions">
        <button className="secondary-button" onClick={onDashboard}>Back to dashboard</button>
        <button className="secondary-button" onClick={onEdit}>Edit checklist</button>
        <button className="print-button" onClick={onPrint}>Print checklist</button>
      </div>
    </main>
  )
}
