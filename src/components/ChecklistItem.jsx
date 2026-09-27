import { useRef } from 'react'
import { markerLabels } from '../data/checklistItems'

export function ChecklistItem({ item, itemState, disabled, readOnly, onStatusChange, onFileChange, onCommentChange }) {
  const status = itemState?.status ?? ''
  const attachment = itemState?.attachment
  const fileInputRef = useRef(null)
  const commentInputRef = useRef(null)

  const handleStatusChange = (nextStatus) => {
    onStatusChange(nextStatus)
    if (nextStatus === 'yes') {
      requestAnimationFrame(() => fileInputRef.current?.click())
    }
    if (nextStatus === 'no') {
      requestAnimationFrame(() => commentInputRef.current?.focus())
    }
  }

  return (
    <article id={`checklist-item-${item.id}`} className={`checklist-item ${item.order.length > 2 ? 'sub-item' : ''} ${disabled ? 'locked' : ''}`}>
      <div className="item-title">
        <span className="item-number">{item.order}</span>
        <div>
          <h3>{item.label}</h3>
          {item.marker && <span className={`marker marker-${item.marker}`}>{markerLabels[item.marker]}</span>}
        </div>
      </div>
      <div className="item-controls">
        <fieldset className="status-controls" disabled={disabled || readOnly}>
          <legend className="sr-only">Document status</legend>
          <label className="status-option status-option-yes">
            <input
              type="radio"
              name={`status-${item.id}`}
              checked={status === 'yes'}
              onChange={() => handleStatusChange('yes')}
            />
            Yes
          </label>
          <label className="status-option status-option-no">
            <input
              type="radio"
              name={`status-${item.id}`}
              checked={status === 'no'}
              onChange={() => handleStatusChange('no')}
            />
            No
          </label>
          <label className="status-option status-option-na">
            <input
              type="radio"
              name={`status-${item.id}`}
              checked={status === 'na'}
              onChange={() => handleStatusChange('na')}
            />
            N/A
          </label>
        </fieldset>
        <label className="attachment-control">
          <span>Attachment</span>
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={disabled || readOnly}
            onChange={(event) => onFileChange(event.target.files?.[0])}
          />
          {attachment && <small>Attached: {attachment.name}</small>}
        </label>
        <label className="comment-control">
          <span>Comments{status === 'no' && !itemState?.comments && <em className="required-hint"> (required)</em>}</span>
          <input
            type="text"
            ref={commentInputRef}
            value={itemState?.comments ?? ''}
            disabled={disabled || readOnly}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder={status === 'no' ? 'Explain why this item is missing' : 'Optional note'}
          />
        </label>
      </div>
    </article>
  )
}
