import { useRef } from 'react'
import { markerLabels } from '../data/checklistItems'
import { COPY_SLOTS, getAssessmentName, getCopyProgress } from '../utils/assessmentCopies'

const acceptedFileTypes = '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function ChecklistItem({
  item,
  itemState,
  disabled,
  readOnly,
  onStatusChange,
  onFileChange,
  onCommentChange,
  onRemoveAttachment,
  onAddAssessmentInstance,
  onRenameAssessmentInstance,
  onRemoveAssessmentInstance,
}) {
  const status = itemState?.status ?? ''
  const fileInputRef = useRef(null)
  const commentInputRef = useRef(null)
  const instances = itemState?.assessmentInstances ?? []

  const handleStatusChange = (nextStatus) => {
    onStatusChange(nextStatus)
    if (nextStatus === 'yes') requestAnimationFrame(() => fileInputRef.current?.click())
    if (nextStatus === 'no') requestAnimationFrame(() => commentInputRef.current?.focus())
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
            <input type="radio" name={`status-${item.id}`} checked={status === 'yes'} onChange={() => handleStatusChange('yes')} />
            Yes
          </label>
          <label className="status-option status-option-no">
            <input type="radio" name={`status-${item.id}`} checked={status === 'no'} onChange={() => handleStatusChange('no')} />
            No
          </label>
          <label className="status-option status-option-na">
            <input type="radio" name={`status-${item.id}`} checked={status === 'na'} onChange={() => handleStatusChange('na')} />
            N/A
          </label>
        </fieldset>
        <div className="attachment-section">
          {item.marker === 'copies' ? (
            <div className="assessment-instance-list">
              {instances.map((instance) => {
                const progress = getCopyProgress(instance)
                return (
                  <section className="assessment-instance" key={instance.id}>
                    <div className="assessment-instance-heading">
                      <label>
                        <span className="sr-only">Assessment name</span>
                        <input
                          type="text"
                          value={instance.label}
                          disabled={disabled || readOnly}
                          onChange={(event) => onRenameAssessmentInstance(item.id, instance.id, event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="attachment-remove"
                        disabled={disabled || readOnly}
                        onClick={() => onRemoveAssessmentInstance(item.id, instance)}
                      >
                        Remove assessment
                      </button>
                    </div>
                    <div className="copy-progress">
                      <strong>{progress.uploaded}/3 copies uploaded</strong>
                      <progress max="3" value={progress.uploaded} />
                    </div>
                    <div className="copy-slot-list">
                      {COPY_SLOTS.map((slot) => {
                        const attachment = instance.attachments?.[slot.id]
                        return (
                          <div className="copy-slot" key={slot.id}>
                            <label className="attachment-control">
                              <span>{slot.label} copy <em className={attachment ? 'slot-uploaded' : 'slot-missing'}>{attachment ? 'Uploaded' : 'Missing'}</em></span>
                              <input
                                type="file"
                                accept={acceptedFileTypes}
                                disabled={disabled || readOnly}
                                onChange={(event) => {
                                  onFileChange(event.target.files?.[0], instance.id, instance.label, slot.id)
                                  event.target.value = ''
                                }}
                              />
                            </label>
                            {attachment && (
                              <div className="attachment-status">
                                <span className="attachment-name" title={attachment.name}>{attachment.name}</span>
                                <button
                                  type="button"
                                  className="attachment-remove"
                                  onClick={() => onRemoveAttachment?.(item.id, attachment, instance.id, slot.id)}
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
                    </div>
                  </section>
                )
              })}
              <button
                type="button"
                className="secondary-button add-assessment-button"
                disabled={disabled || readOnly}
                onClick={() => onAddAssessmentInstance(item.id)}
              >
                Add another {getAssessmentName(item.id).toLowerCase()}
              </button>
            </div>
          ) : (
            <>
              <label className="attachment-control">
                <span>Attachment</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={acceptedFileTypes}
                  disabled={disabled || readOnly}
                  onChange={(event) => {
                    onFileChange(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
              {itemState?.attachment && (
                <div className="attachment-status">
                  <span className="attachment-name" title={itemState.attachment.name}>Attached: {itemState.attachment.name}</span>
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
