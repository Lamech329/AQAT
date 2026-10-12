import { useRef, useState } from 'react'
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
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState({})
  const [expandedInstances, setExpandedInstances] = useState({})
  const isNA = status === 'na'
  const regularAttachments = Array.isArray(itemState?.attachments) ? itemState.attachments.filter(Boolean) : itemState?.attachment ? [itemState.attachment] : []

  const handleStatusChange = (nextStatus) => {
    onStatusChange(nextStatus)
    if (nextStatus === 'yes' && item.marker !== 'copies') requestAnimationFrame(() => fileInputRef.current?.click())
    if (nextStatus === 'no') requestAnimationFrame(() => commentInputRef.current?.focus())
  }

  const uploadFiles = async (files) => {
    for (const file of files) {
      setUploading((current) => ({ ...current, [file.name]: true }))
      try {
        await onFileChange([file])
      } finally {
        setUploading((current) => {
          const next = { ...current }
          delete next[file.name]
          return next
        })
      }
    }
  }

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    try {
      await uploadFiles(files)
    } finally {
      event.target.value = ''
    }
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    if (disabled || readOnly || isNA) return
    const files = Array.from(event.dataTransfer.files ?? [])
    if (!files.length) return
    setDragging(false)
    await uploadFiles(files)
  }

  const handleCopySlotUpload = async (event, instance, slot) => {
    const file = event.target.files?.[0]
    const uploadKey = `${instance.id}:${slot.id}`
    if (!file) return
    setUploading((current) => ({ ...current, [uploadKey]: true }))
    try {
      await onFileChange(file, instance.id, instance.label, slot.id)
    } finally {
      setUploading((current) => {
        const next = { ...current }
        delete next[uploadKey]
        return next
      })
      event.target.value = ''
    }
  }

  const renderRegularAttachments = () => (
    <div className={`regular-attachments ${isNA ? 'locked' : ''}`}>
      <div className={`attachment-dropzone ${dragging ? 'dragging' : ''} ${isNA ? 'na-locked' : ''}`} onDragOver={(event) => { if (!isNA) { event.preventDefault(); setDragging(true) } }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
        <label className="dropzone-picker">
          <input
            className="visually-hidden"
            type="file"
            ref={fileInputRef}
            accept={acceptedFileTypes}
            disabled={disabled || readOnly || isNA}
            multiple
            onChange={handleFileUpload}
          />
          <span className="dropzone-label">Choose files or drop them here</span>
        </label>
      </div>
      {(regularAttachments.length > 0 || Object.keys(uploading).length > 0) && (
        <div className="file-chip-list">
          {regularAttachments.length > 0 && <div className="file-chip-total">{regularAttachments.length} file{regularAttachments.length > 1 ? 's' : ''}</div>}
          {regularAttachments.map((attachment) => (
            <div className="file-chip" key={`${attachment.path || attachment.name}-${attachment.size || ''}`}>
              <span className="file-chip-icon" aria-hidden="true">▤</span>
              <span className="file-chip-name" title={attachment.name}>{attachment.name}</span>
              <span className="file-chip-size">{attachment.size ? `${Math.max(1, Math.round(attachment.size / 1024))} KB` : 'File'}</span>
              <button type="button" className="file-chip-remove" onClick={() => onRemoveAttachment?.(item.id, attachment)} aria-label={`Remove ${attachment.name}`} disabled={disabled || readOnly || isNA}>×</button>
            </div>
          ))}
          {Object.keys(uploading).map((name) => (
            <div className="file-chip file-chip-uploading" key={`uploading-${name}`}>
              <span className="file-chip-icon" aria-hidden="true">▤</span>
              <span className="file-chip-name">{name}</span>
              <span className="upload-spinner" role="status" aria-label={`Uploading ${name}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <article id={`checklist-item-${item.id}`} className={`checklist-item ${item.order.length > 2 ? 'sub-item' : ''} ${disabled ? 'locked' : ''}`}>
      <div className="item-header-row">
        <div className="item-title">
          <span className="item-number">{item.order}</span>
          <div>
            <h3>{item.label}</h3>
            {item.marker && <span className={`marker marker-${item.marker}`}>{markerLabels[item.marker]}</span>}
          </div>
        </div>
        <div className="item-controls-row">
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
          <label className="comment-control">
            <span>Comments{status === 'no' && !itemState?.comments && <em className="required-hint"> (required)</em>}</span>
            <input
              type="text"
              ref={commentInputRef}
              value={itemState?.comments ?? ''}
              disabled={disabled || readOnly || isNA}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder={status === 'no' ? 'Explain why this item is missing' : 'Optional note'}
            />
          </label>
        </div>
      </div>

      {item.marker === 'copies' ? (
        <div className={`assessment-instance-panel ${isNA ? 'na-locked-panel' : ''}`}>
          {isNA && (
            <div className="na-lock-row">
              <span className="na-status-badge">N/A</span>
              <span className="na-note">Not applicable, no files required</span>
              <button type="button" className="link-button" onClick={() => onStatusChange('yes')} disabled={disabled || readOnly}>Change</button>
            </div>
          )}
          <div className="assessment-instance-grid">
            {instances.map((instance) => {
              const progress = getCopyProgress(instance)
              const complete = progress.uploaded === progress.required
              return (
                <section className={`assessment-instance ${complete ? 'instance-complete' : ''}`} key={instance.id}>
                  {complete && !expandedInstances[instance.id] ? (
                    <button
                      type="button"
                      className="instance-summary-toggle"
                      aria-expanded="false"
                      onClick={() => setExpandedInstances((current) => ({ ...current, [instance.id]: true }))}
                    >
                      <span>{instance.label}</span>
                      <span className="instance-summary-status">✓ {progress.uploaded}/{progress.required}</span>
                    </button>
                  ) : (
                    <>
                  <div className="assessment-instance-heading">
                    <label>
                      <span className="sr-only">Assessment name</span>
                      <input
                        type="text"
                        value={instance.label}
                        disabled={disabled || readOnly || isNA}
                        onChange={(event) => onRenameAssessmentInstance(item.id, instance.id, event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-button destroy-instance-button"
                      disabled={disabled || readOnly || isNA}
                      onClick={() => onRemoveAssessmentInstance(item.id, instance)}
                      aria-label={`Remove ${instance.label}`}
                      title="Remove assessment instance"
                    >
                      <span aria-hidden="true">🗑</span>
                    </button>
                    {complete && (
                      <button
                        type="button"
                        className="instance-collapse-button"
                        aria-expanded="true"
                        onClick={() => setExpandedInstances((current) => ({ ...current, [instance.id]: false }))}
                      >
                        Collapse
                      </button>
                    )}
                  </div>
                  <div className="copy-progress-row">
                    <span className="copy-progress-pill">{progress.uploaded}/{progress.required}</span>
                    {complete && <span className="copy-complete-tag">✓</span>}
                  </div>
                  <div className="copy-slot-list">
                    {COPY_SLOTS.map((slot) => {
                      const attachment = instance.attachments?.[slot.id]
                      const isUploading = uploading[`${instance.id}:${slot.id}`]
                      return (
                        <div className="copy-slot" key={slot.id}>
                          <div className="copy-slot-header">
                            <span className="copy-slot-name">{slot.label}</span>
                            <span className={`status-dot ${attachment ? 'filled' : 'empty'}`} aria-label={attachment ? 'Uploaded' : 'Missing'} />
                          </div>
                          {!attachment ? (
                            <label className={`attachment-control ${isNA ? 'na-locked' : ''}`}>
                              <span className="slot-dropzone-label">{isUploading ? 'Uploading…' : 'Choose file'}</span>
                              <input
                                className="visually-hidden"
                                type="file"
                                accept={acceptedFileTypes}
                                disabled={disabled || readOnly || isNA || isUploading}
                                onChange={(event) => handleCopySlotUpload(event, instance, slot)}
                              />
                              {isUploading && <span className="upload-spinner" role="status" aria-label={`Uploading ${slot.label}`} />}
                            </label>
                          ) : (
                            <div className="file-chip file-chip-inline">
                              <span className="file-chip-icon" aria-hidden="true">▤</span>
                              <span className="file-chip-name" title={attachment.name}>{attachment.name}</span>
                              <button type="button" className="file-chip-remove" onClick={() => onRemoveAttachment?.(item.id, attachment, instance.id, slot.id)} aria-label={`Remove ${attachment.name}`} disabled={disabled || readOnly || isNA}>×</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                    </>
                  )}
                </section>
              )
            })}
          </div>
          <button type="button" className="secondary-button add-assessment-button" disabled={disabled || readOnly || isNA} onClick={() => onAddAssessmentInstance(item.id)}>
            + Add {getAssessmentName(item.id).toLowerCase()}
          </button>
        </div>
      ) : (
        <div className="regular-attachment-panel">
          {status === 'na' ? (
            <div className="na-lock-row">
              <span className="na-status-badge">N/A</span>
              <span className="na-note">Not applicable, no files required</span>
              <button type="button" className="link-button" onClick={() => onStatusChange('yes')} disabled={disabled || readOnly}>Change</button>
            </div>
          ) : (
            renderRegularAttachments()
          )}
        </div>
      )}
    </article>
  )
}
