import { useState } from 'react'
import { pingApi, saveApiConfig } from '../api/checklistApi'

export function SettingsButton({ onClick }) {
  return (
    <button className="settings-button" type="button" onClick={onClick} aria-label="Open settings" title="Settings">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25ZM19.1 13.5a7.58 7.58 0 0 0 .06-1.5 7.58 7.58 0 0 0-.06-1.5l2-1.56-2-3.46-2.36.96a7.27 7.27 0 0 0-2.59-1.5L13.8 2.5h-4l-.35 2.44a7.27 7.27 0 0 0-2.59 1.5L4.5 5.48l-2 3.46 2 1.56a7.58 7.58 0 0 0-.06 1.5 7.58 7.58 0 0 0 .06 1.5l-2 1.56 2 3.46 2.36-.96a7.27 7.27 0 0 0 2.59 1.5l.35 2.44h4l.35-2.44a7.27 7.27 0 0 0 2.59-1.5l2.36.96 2-3.46-2-1.56Z" />
      </svg>
    </button>
  )
}

export function SettingsPanel({ config, onClose, onSave }) {
  const [draft, setDraft] = useState(config)
  const [feedback, setFeedback] = useState(null)
  // show remote fields only for REST/API modes; Supabase uses env configuration
  const isRemote = draft.mode === 'rest' || draft.mode === 'database'

  const update = (name, value) => {
    setDraft((current) => ({ ...current, [name]: value }))
    setFeedback(null)
  }

  const save = () => {
    const savedConfig = saveApiConfig(draft)
    setDraft(savedConfig)
    onSave(savedConfig)
    return savedConfig
  }

  const handleTest = async () => {
    setFeedback({ state: 'testing', message: 'Testing connection...' })
    save()
    try {
      const result = await pingApi()
      setFeedback({ state: 'success', message: result?.message || 'Connection successful.' })
    } catch (error) {
      setFeedback({ state: 'error', message: error.message })
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    save()
    onClose()
  }

  return (
    <div className="settings-overlay" role="presentation" onMouseDown={onClose}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-heading">
          <div>
            <p className="eyebrow">Department administration</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close settings">×</button>
        </div>
        <p className="settings-intro">Choose where the checklist data is stored. Local storage keeps data in this browser.</p>
        <form onSubmit={handleSubmit}>
          <label>
            <span>Data Source</span>
            <select value={draft.mode} onChange={(event) => update('mode', event.target.value)}>
              <option value="local">Local storage</option>
              <option value="rest" disabled title="Temporarily disabled">Custom REST API (temporarily disabled)</option>
              <option value="database" disabled title="Temporarily disabled">Custom Database via API (temporarily disabled)</option>
              <option value="supabase">Supabase</option>
            </select>
          </label>

          <p className="mode-disabled-note">
            Custom API modes are currently disabled. Supabase is the active, fully supported backend for this deployment. They remain in the codebase as a planned extensibility option for future institutional integration.
          </p>

          {draft.mode === 'supabase' && (
            <div className="supabase-note">
              <p>Using Supabase for storage and auth. Base URL and credentials are managed via environment variables.</p>
            </div>
          )}

          {isRemote && (
            <div className="remote-settings">
              <label>
                <span>Base URL</span>
                <input type="url" value={draft.baseUrl} onChange={(event) => update('baseUrl', event.target.value)} placeholder="https://api.example.edu" required />
              </label>
              <label>
                <span>Auth Type</span>
                <select value={draft.authType} onChange={(event) => update('authType', event.target.value)}>
                  <option value="none">None</option>
                  <option value="apiKey">API Key</option>
                  <option value="bearer">Bearer token</option>
                </select>
              </label>
              {draft.authType !== 'none' && (
                <label>
                  <span>{draft.authType === 'apiKey' ? 'API Key' : 'Bearer token'}</span>
                  <input type="password" value={draft.credential} onChange={(event) => update('credential', event.target.value)} autoComplete="off" required />
                </label>
              )}
            </div>
          )}
          {feedback && <p className={`connection-feedback ${feedback.state}`}>{feedback.message}</p>}
          <div className="settings-actions">
            <button className="secondary-button" type="button" onClick={handleTest} disabled={feedback?.state === 'testing'}>
              {feedback?.state === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            <button className="submit-button" type="submit">Save Settings</button>
          </div>
        </form>
      </aside>
    </div>
  )
}
