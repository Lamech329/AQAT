import { SettingsButton } from './SettingsPanel'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { DashboardTabs } from './DashboardTabs'

export function Dashboard({ checklists, onNew, onOpen, onView, onEdit, theme, onThemeToggle, onSettingsOpen }) {
  return (
    <main className="app-shell">
      <header className="page-header">
        <div className="brand-mark">AQAT</div>
        <div>
          <p className="eyebrow">Academic Quality Assurance Team</p>
          <h1>Subject File Checklists</h1>
          <p>Start, continue, and review end-of-semester compliance records.</p>
        </div>
        <div className="header-actions">
          <DashboardTabs />
          <UserMenu />
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <SettingsButton onClick={onSettingsOpen} />
        </div>
      </header>
      <section className="card dashboard-card" aria-labelledby="checklist-history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Checklist history</p>
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
                <tr><th>Subject Name</th><th>Subject Code</th><th>Semester</th><th>Year</th><th>Status</th><th>Submitted</th><th className="actions-column">Action</th></tr>
              </thead>
              <tbody>
                {checklists.map((checklist) => (
                  <tr key={checklist.id}>
                    <td>{checklist.subjectName || 'Untitled checklist'}</td>
                    <td>{checklist.subjectCode || '—'}</td>
                    <td>{checklist.semester || '—'}</td>
                    <td>{checklist.year || '—'}</td>
                    <td><span className={`status-badge ${checklist.status}`}>{checklist.status === 'submitted' ? 'Submitted' : 'Draft'}</span></td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
