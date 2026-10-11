import { SettingsButton } from './SettingsPanel'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { DashboardTabs } from './DashboardTabs'
import { COPY_SLOTS, MARKED_ASSESSMENTS, getCopyProgress, getMissingCopySlots } from '../utils/assessmentCopies'

export function Dashboard({ checklists, onNew, onOpen, onView, onEdit, theme, onThemeToggle, onSettingsOpen }) {
  const drafts = checklists.filter((checklist) => checklist.status !== 'submitted')
  const submitted = checklists.length - drafts.length
  return (
    <main className="app-shell">
      <header className="page-header">
        <div className="brand-mark">AQAT</div>
        <div>
          <p className="eyebrow">Academic Quality Assurance Team</p>
          <h1>Staff checklist dashboard</h1>
          <p>Track drafts, submissions, and the three required marked copies.</p>
        </div>
        <div className="header-actions">
          <DashboardTabs />
          <UserMenu />
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <SettingsButton onClick={onSettingsOpen} />
        </div>
      </header>
      <section className="staff-summary-grid" aria-label="Submission status">
        <div className="card staff-summary"><span>Total checklists</span><strong>{checklists.length}</strong></div>
        <div className="card staff-summary"><span>Drafts in progress</span><strong>{drafts.length}</strong></div>
        <div className="card staff-summary"><span>Submitted</span><strong>{submitted}</strong></div>
      </section>
      <section className="card dashboard-card" aria-labelledby="checklist-history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Drafts and submission status</p>
            <h2 id="checklist-history">Your checklists</h2>
          </div>
          <button className="submit-button" onClick={onNew}>+ New Checklist</button>
        </div>
        {checklists.length === 0 ? (
          <div className="empty-dashboard">
            <h3>No checklists yet</h3>
            <p>Create a checklist to begin recording your subject-file documents.</p>
          </div>
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr><th>Subject Name</th><th>Subject Code</th><th>Department</th><th>Status</th><th>Marked-copy progress</th><th>Submitted</th><th className="actions-column">Action</th></tr>
              </thead>
              <tbody>
                {checklists.map((checklist) => {
                  const missing = getMissingCopySlots(checklist.items ?? {})
                  const requiredAssessments = MARKED_ASSESSMENTS.filter((assessment) => checklist.items?.[assessment.id]?.status !== 'na')
                  const totalSlots = requiredAssessments.reduce((total, assessment) => (
                    total + Math.max(1, checklist.items?.[assessment.id]?.assessmentInstances?.length ?? 1) * COPY_SLOTS.length
                  ), 0)
                  const completeSlots = requiredAssessments.reduce((total, assessment) => (
                    total + (checklist.items?.[assessment.id]?.assessmentInstances ?? []).reduce(
                      (sum, instance) => sum + getCopyProgress(instance).uploaded,
                      0,
                    )
                  ), 0)
                  return (
                  <tr key={checklist.id}>
                    <td>{checklist.subjectName || 'Untitled checklist'}</td>
                    <td>{checklist.subjectCode || '—'}</td>
                    <td>{checklist.department || '—'}</td>
                    <td><span className={`status-badge ${checklist.status}`}>{checklist.status === 'submitted' ? 'Submitted' : 'Draft'}</span></td>
                    <td>
                      <strong>{completeSlots}/{totalSlots} slots</strong>
                      <div className="dashboard-copy-progress">
                        {MARKED_ASSESSMENTS.map((assessment) => {
                          const state = checklist.items?.[assessment.id] ?? {}
                          const instances = state.assessmentInstances ?? []
                          const progress = instances.reduce((sum, instance) => sum + getCopyProgress(instance).uploaded, 0)
                          const required = state.status === 'na' ? 0 : Math.max(1, instances.length) * COPY_SLOTS.length
                          return <span key={assessment.id} title={`${assessment.label}: ${state.status === 'na' ? 'N/A' : `${progress}/${required}`}`} className={progress === required ? 'copy-progress-complete' : ''}>{assessment.order} {state.status === 'na' ? 'N/A' : `${progress}/${required}`}</span>
                        })}
                      </div>
                      {missing.length > 0 && <details className="dashboard-missing"><summary>{missing.length} missing copy slot(s)</summary><ul>{missing.map(({ assessmentId, assessmentLabel, assessmentInstanceLabel, label }) => <li key={`${assessmentId}-${assessmentInstanceLabel}-${label}`}>{assessmentLabel}: {assessmentInstanceLabel ? `${assessmentInstanceLabel}: ` : ''}{label}</li>)}</ul></details>}
                    </td>
                    <td>{checklist.submittedAt ? new Date(checklist.submittedAt).toLocaleDateString() : '—'}</td>
                    <td className="dashboard-actions">
                      {checklist.status === 'submitted' ? (
                        <>
                          <button className="secondary-button" onClick={() => onView(checklist.id)}>View</button>
                          <button className="secondary-button" onClick={() => onEdit(checklist.id)}>Edit</button>
                        </>
                      ) : <button className="secondary-button" onClick={() => onOpen(checklist.id)}>Open / Continue</button>}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
