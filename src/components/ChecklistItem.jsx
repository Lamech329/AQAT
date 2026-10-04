import { useRef } from 'react'
import { markerLabels } from '../data/checklistItems'
import { COPY_SLOTS, getCopyProgress } from '../utils/assessmentCopies'

export function ChecklistItem({ item, itemState, disabled, readOnly, onStatusChange, onFileChange, onCommentChange, onRemoveAttachment }) {
  const status = itemState?.status ?? ''
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

  const handleRemoveAttachment = () => {
    onRemoveAttachment?.(item.id, itemState?.attachment)
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
        <div className="attachment-section">
          {item.marker === 'copies' ? (
            <div className="copy-slot-list">
              <div className="copy-progress">
                <strong>{getCopyProgress(itemState ? { [item.id]: itemState } : {}, item.id).uploaded}/3 copies uploaded</strong>
                <progress max="3" value={getCopyProgress(itemState ? { [item.id]: itemState } : {}, item.id).uploaded} />
              </div>
              {COPY_SLOTS.map((slot) => {
                const attachment = itemState?.attachments?.[slot.id]
                return (
                  <div className="copy-slot" key={slot.id}>
                    <label className="attachment-control">
                      <span>{slot.label} copy <em className={attachment ? 'slot-uploaded' : 'slot-missing'}>{attachment ? 'Uploaded' : 'Missing'}</em></span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        disabled={disabled || readOnly}
                        onChange={(event) => {
                          onFileChange(event.target.files?.[0], slot.id)
                          event.target.value = ''
                        }}
                      />
                    </label>
                    {attachment && (
                      <div className="attachment-status">
                        <span className="attachment-name">{attachment.name}</span>
                        <button
                          type="button"
                          className="attachment-remove"
                          onClick={() => onRemoveAttachment?.(item.id, attachment, slot.id)}
                          disabled={disabled || readOnly}
                          aria-label={`Remove ${slot.label.toLowerCase()} copy: ${attachment.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {itemState?.attachment && <p className="legacy-attachment">Existing unlabelled attachment retained: {itemState.attachment.name}. Add all three labelled copies.</p>}
            </div>
          ) : (
            <>
              <label className="attachment-control">
                <span>Attachment</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={disabled || readOnly}
                  onChange={(event) => {
                    onFileChange(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
              {itemState?.attachment && (
                <div className="attachment-status">
                  <span className="attachment-name">Attached: {itemState.attachment.name}</span>
                  <button
                    type="button"
                    className="attachment-remove"
                    onClick={handleRemoveAttachment}
                    disabled={disabled || readOnly}
                    aria-label={`Remove attachment: ${itemState.attachment.name}`}
                    title="Remove this attachment"
                  >
                    Remove
                  </button>
                </div>
              )}
            </>
          )}
        </div>
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
