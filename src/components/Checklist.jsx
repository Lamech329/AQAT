import { ChecklistItem } from './ChecklistItem'

export function Checklist({ items, itemState, headerComplete, readOnly, onStatusChange, onFileChange, onCommentChange, onRemoveAttachment }) {
  let previousResolved = true
  let completeCount = 0

  const rows = items.map((item) => {
    const state = itemState[item.id]
    const resolved = Boolean(state?.status)
    const disabled = !headerComplete || !previousResolved
    previousResolved = resolved
    if (resolved) completeCount += 1

    return (
      <ChecklistItem
        key={item.id}
        item={item}
        itemState={state}
        disabled={disabled}
        readOnly={readOnly}
        onStatusChange={(status) => onStatusChange(item.id, status)}
        onFileChange={(file) => onFileChange(item.id, file)}
        onCommentChange={(comments) => onCommentChange(item.id, comments)}
        onRemoveAttachment={onRemoveAttachment}
      />
    )
  })

  return (
    <section className="card checklist-card" aria-labelledby="checklist-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step-by-step confirmation</p>
          <h2 id="checklist-heading">Subject file checklist</h2>
        </div>
        <div className="progress" aria-label={`${completeCount} of ${items.length} requirements completed`}>
          <strong>{completeCount} of {items.length}</strong>
          <span>requirements completed</span>
        </div>
      </div>
      {!headerComplete && <p className="unlock-notice">Complete the subject details above to start the checklist.</p>}
      <div className="checklist-list">{rows}</div>
    </section>
  )
}
