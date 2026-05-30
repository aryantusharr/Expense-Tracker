import { useState, useRef, useCallback, useEffect } from 'react';
import Modal from '../common/Modal';
import { parseCSVForMapping, applyMappings, importToFirestore } from '../../services/csvImportService';
import { useRoomContext } from '../../context/RoomContext';
import './ImportCSVModal.css';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportCSVModal({ isOpen, onClose }) {
  const { room, roomCode, users: roomUsers, categories: roomCategories } = useRoomContext();
  const isPersonal = room?.isPersonal === true;

  // Step management
  const [step, setStep] = useState('prereq'); // prereq | upload | mapping-people | mapping-splits | mapping-categories | preview | importing | success
  
  // Data state
  const [file, setFile] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [uniqueCategories, setUniqueCategories] = useState([]);
  const [uniquePaidBy, setUniquePaidBy] = useState([]);
  const [uniqueSplits, setUniqueSplits] = useState([]);
  
  // Mapping state
  const [categoryMap, setCategoryMap] = useState({});
  const [peopleMap, setPeopleMap] = useState({});
  const [splitMap, setSplitMap] = useState({});

  // Processed state
  const [processedRows, setProcessedRows] = useState([]);
  const [additionalSkipped, setAdditionalSkipped] = useState([]);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  
  // UI state
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [prereqChecked, setPrereqChecked] = useState(false);
  const inputRef = useRef(null);

  // Load mappings from localStorage on mount
  useEffect(() => {
    if (isOpen && roomCode) {
      try {
        const saved = JSON.parse(localStorage.getItem(`csv-mappings-${roomCode}`) || '{}');
        if (saved.categoryMap) setCategoryMap(saved.categoryMap);
        if (saved.peopleMap) setPeopleMap(saved.peopleMap);
        if (saved.splitMap) setSplitMap(saved.splitMap);
      } catch (e) { console.error('Failed to load mappings', e); }
    }
  }, [isOpen, roomCode]);

  const reset = useCallback(() => {
    setStep('prereq');
    setFile(null);
    setRawRows([]);
    setSkipped([]);
    setUniqueCategories([]);
    setUniquePaidBy([]);
    setUniqueSplits([]);
    setProcessedRows([]);
    setAdditionalSkipped([]);
    setProgress(0);
    setImportResult(null);
    setDragOver(false);
    setErrorMsg(null);
    setPrereqChecked(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleResetMappings = () => {
    setCategoryMap({});
    setPeopleMap({});
    setSplitMap({});
    localStorage.removeItem(`csv-mappings-${roomCode}`);
  };

  // ── File Selection ─────────────────────────────────────────
  const handleFile = async (f) => {
    if (!f || !f.name.endsWith('.csv')) {
      setErrorMsg('Please upload a .csv file only.');
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setStep('upload'); // Show loading state briefly

    try {
      const result = await parseCSVForMapping(f, isPersonal);
      setRawRows(result.rawRows);
      setSkipped(result.skipped);
      setUniqueCategories(result.uniqueCategories);
      setUniquePaidBy(result.uniquePaidBy);
      setUniqueSplits(result.uniqueSplits);

      if (isPersonal) {
        setStep('mapping-categories');
      } else {
        setStep('mapping-people');
      }
    } catch (err) {
      setErrorMsg(err.message);
      setFile(null); // allow re-upload
      setStep('upload');
    }
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  // ── Navigation ─────────────────────────────────────────────
  const goToPreview = () => {
    const { processedRows: pRows, additionalSkipped: aSkip } = applyMappings(
      rawRows, 
      { categoryMap, peopleMap, splitMap }, 
      isPersonal, 
      roomUsers
    );
    setProcessedRows(pRows);
    setAdditionalSkipped(aSkip);
    setStep('preview');
  };

  const handleNext = () => {
    if (step === 'mapping-people') setStep('mapping-splits');
    else if (step === 'mapping-splits') setStep('mapping-categories');
    else if (step === 'mapping-categories') goToPreview();
  };

  const handleBack = () => {
    if (step === 'mapping-splits') setStep('mapping-people');
    else if (step === 'mapping-categories') {
      if (isPersonal) {
        setStep('upload');
        setFile(null);
      } else {
        setStep('mapping-splits');
      }
    }
    else if (step === 'preview') setStep('mapping-categories');
  };

  // ── Validation ─────────────────────────────────────────────
  const isMappingComplete = () => {
    if (step === 'mapping-people') {
      return uniquePaidBy.every(u => peopleMap[u]);
    }
    if (step === 'mapping-splits') {
      return uniqueSplits.every(s => splitMap[s] && splitMap[s].length > 0);
    }
    if (step === 'mapping-categories') {
      return uniqueCategories.every(c => categoryMap[c]);
    }
    return true;
  };

  // ── Import ─────────────────────────────────────────────────
  const handleImport = async () => {
    setStep('importing');
    setProgress(0);

    const result = await importToFirestore(roomCode, processedRows, (percent) => {
      setProgress(percent);
    });

    setImportResult(result);

    if (result.imported > 0) {
      // Save mappings to localStorage
      localStorage.setItem(`csv-mappings-${roomCode}`, JSON.stringify({
        categoryMap, peopleMap, splitMap
      }));

      // Save history
      const history = JSON.parse(localStorage.getItem('csv-import-history') || '[]');
      history.unshift({
        timestamp: new Date().toISOString(),
        count: result.imported,
        filename: file?.name || 'unknown.csv',
      });
      localStorage.setItem('csv-import-history', JSON.stringify(history.slice(0, 10)));
    }

    setStep('success');
  };

  const downloadFailedRows = () => {
    if (!importResult?.errors) return;
    const csvContent = "data:text/csv;charset=utf-8,Row Number,Error Message\n" 
      + importResult.errors.map(e => `${e.rowIndex},"${e.error.replace(/"/g, '""')}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "failed_imports.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Render Helpers ─────────────────────────────────────────

  const getUserName = (id) => roomUsers.find(u => u.id === id)?.name || id;
  const getCatName = (id) => roomCategories.find(c => c.id === id)?.name || id;

  const renderPrereq = () => (
    <div className="import-prereq">
      <div className="import-prereq-alert">
        <strong>⚠️ Required CSV Columns</strong>
        <p>Your CSV file MUST contain the following exact column headers to be imported successfully:</p>
        <ul className="import-prereq-list">
          <li><strong>Date</strong></li>
          <li><strong>Description</strong></li>
          <li><strong>Category</strong></li>
          <li><strong>Amount</strong></li>
          {!isPersonal && <li><strong>Paid By</strong></li>}
          {!isPersonal && <li><strong>Split Between</strong></li>}
        </ul>
        <p className="import-prereq-sub">Other columns will be ignored. Date format should be "DD Mon YYYY" or "YYYY-MM-DD".</p>
      </div>

      <label className="import-checkbox-label">
        <input 
          type="checkbox" 
          checked={prereqChecked} 
          onChange={(e) => setPrereqChecked(e.target.checked)} 
        />
        <span>I confirm my CSV file has these exact columns.</span>
      </label>

      <button 
        className="btn btn-primary btn-full" 
        style={{ marginTop: 'var(--space-lg)' }}
        disabled={!prereqChecked}
        onClick={() => setStep('upload')}
      >
        Continue
      </button>
    </div>
  );

  const renderIdle = () => (
    <>
      <div
        className={`import-upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          tabIndex={-1}
        />
        <span className="upload-icon">📄</span>
        <div className="upload-label">
          {dragOver ? 'Drop your CSV here' : 'Choose CSV File'}
        </div>
        <div className="upload-hint">
          Drag & drop or tap to browse · .csv only
        </div>
      </div>
      {errorMsg && (
        <div className="import-error-msg">
          ⚠️ {errorMsg}
        </div>
      )}
    </>
  );

  const renderMappingPeople = () => (
    <div className="mapping-step">
      <div className="mapping-header">
        <h4>Map People (Paid By)</h4>
        <p>Match the names from your CSV to the users in this room.</p>
        <button className="btn btn-sm btn-secondary reset-map-btn" onClick={handleResetMappings}>Reset Mappings</button>
      </div>
      <div className="mapping-list">
        {uniquePaidBy.length === 0 ? (
          <p className="mapping-empty">No unique people found in CSV.</p>
        ) : (
          uniquePaidBy.map(csvName => (
            <div key={csvName} className={`mapping-row ${!peopleMap[csvName] ? 'unmapped' : ''}`}>
              <div className="mapping-csv-val">{csvName}</div>
              <div className="mapping-arrow">→</div>
              <select 
                className="input mapping-select" 
                value={peopleMap[csvName] || ''} 
                onChange={(e) => setPeopleMap(prev => ({...prev, [csvName]: e.target.value}))}
              >
                <option value="" disabled>Select User...</option>
                {roomUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>
      {!isMappingComplete() && <div className="mapping-warning">Please map all people before continuing.</div>}
      <div className="import-actions">
        <button className="btn btn-secondary" onClick={handleBack}>Back</button>
        <button className="btn btn-primary" onClick={handleNext} disabled={!isMappingComplete()}>Next</button>
      </div>
    </div>
  );

  const renderMappingSplits = () => (
    <div className="mapping-step">
      <div className="mapping-header">
        <h4>Map Split Groups</h4>
        <p>Select which users are included in each split group from your CSV.</p>
        <button className="btn btn-sm btn-secondary reset-map-btn" onClick={handleResetMappings}>Reset Mappings</button>
      </div>
      <div className="mapping-list">
        {uniqueSplits.length === 0 ? (
           <p className="mapping-empty">No unique split groups found in CSV.</p>
        ) : (
          uniqueSplits.map(csvSplit => {
            const currentSelected = splitMap[csvSplit] || [];
            return (
              <div key={csvSplit} className={`mapping-row-col ${currentSelected.length === 0 ? 'unmapped' : ''}`}>
                <div className="mapping-csv-val">{csvSplit}</div>
                <div className="mapping-checkboxes">
                  {roomUsers.map(u => (
                    <label key={u.id} className="mapping-checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={currentSelected.includes(u.id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setSplitMap(prev => {
                            const arr = prev[csvSplit] || [];
                            return {
                              ...prev,
                              [csvSplit]: isChecked ? [...arr, u.id] : arr.filter(id => id !== u.id)
                            };
                          });
                        }}
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      {!isMappingComplete() && <div className="mapping-warning">Please map all split values before continuing.</div>}
      <div className="import-actions">
        <button className="btn btn-secondary" onClick={handleBack}>Back</button>
        <button className="btn btn-primary" onClick={handleNext} disabled={!isMappingComplete()}>Next</button>
      </div>
    </div>
  );

  const renderMappingCategories = () => (
    <div className="mapping-step">
      <div className="mapping-header">
        <h4>Map Categories</h4>
        <p>Match categories from your CSV to room categories.</p>
        <button className="btn btn-sm btn-secondary reset-map-btn" onClick={handleResetMappings}>Reset Mappings</button>
      </div>
      <div className="mapping-list">
        {uniqueCategories.length === 0 ? (
          <p className="mapping-empty">No unique categories found in CSV.</p>
        ) : (
          uniqueCategories.map(csvCat => (
            <div key={csvCat} className={`mapping-row ${!categoryMap[csvCat] ? 'unmapped' : ''}`}>
              <div className="mapping-csv-val">{csvCat}</div>
              <div className="mapping-arrow">→</div>
              <select 
                className="input mapping-select" 
                value={categoryMap[csvCat] || ''} 
                onChange={(e) => setCategoryMap(prev => ({...prev, [csvCat]: e.target.value}))}
              >
                <option value="" disabled>Select Category...</option>
                {roomCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>
      {!isMappingComplete() && <div className="mapping-warning">Please map all categories before continuing.</div>}
      <div className="import-actions">
        <button className="btn btn-secondary" onClick={handleBack}>Back</button>
        <button className="btn btn-primary" onClick={handleNext} disabled={!isMappingComplete()}>Preview</button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <>
      <div className="import-stats">
        <div className="import-stat-badge parsed">
          <span className="stat-num">{processedRows.length}</span> ready to import
        </div>
        <div className={`import-stat-badge ${skipped.length + additionalSkipped.length > 0 ? 'skipped' : 'neutral'}`}>
          <span className="stat-num">{skipped.length + additionalSkipped.length}</span> skipped
        </div>
      </div>

      {processedRows.length > 0 && (
        <div className="import-preview-wrap">
          <table className="import-preview-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                {!isPersonal && <th>Paid By</th>}
                {!isPersonal && <th>Split</th>}
              </tr>
            </thead>
            <tbody>
              {processedRows.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td className="truncate" style={{maxWidth: '120px'}}>{r.description || '—'}</td>
                  <td>{getCatName(r.categoryId)}</td>
                  <td className="amount-cell">₹{r.amount.toLocaleString('en-IN')}</td>
                  {!isPersonal && <td>{getUserName(r.paidBy)}</td>}
                  {!isPersonal && <td>{r.splitAmong.map(getUserName).join(', ')}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(skipped.length > 0 || additionalSkipped.length > 0) && (
        <div className="import-errors">
          <div className="import-errors-title">⚠️ Skipped Rows</div>
          <div className="import-error-list">
            {skipped.map((s, i) => (
              <div key={`s-${i}`} className="import-error-item">
                Row {s.rowNum}: {s.reason}
              </div>
            ))}
            {additionalSkipped.map((s, i) => (
              <div key={`as-${i}`} className="import-error-item">
                Row {s.rowNum}: {s.reason}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="import-actions">
        <button className="btn btn-secondary" onClick={handleBack}>Back</button>
        <button
          className="btn btn-primary"
          onClick={handleImport}
          disabled={processedRows.length === 0}
        >
          📥 Import All ({processedRows.length})
        </button>
      </div>
    </>
  );

  const renderImporting = () => (
    <div className="import-progress-section">
      <div className="import-progress-percent">{progress}%</div>
      <div className="import-progress-track">
        <div className="import-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="import-progress-text">
        Importing expenses to Firestore…
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="import-success">
      <span className="import-success-icon">✅</span>
      <div className="import-success-title">Import Complete</div>
      <div className="import-success-count">{importResult?.imported || 0}</div>
      <div className="import-success-sub">expenses imported successfully.</div>

      {importResult?.errors?.length > 0 && (
        <div className="import-errors" style={{ marginTop: 'var(--space-xl)' }}>
          <div className="import-errors-title">⚠️ {importResult.errors.length} Failed</div>
          <p style={{fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)'}}>
            Failed to save — Firebase error. See list below.
          </p>
          <div className="import-error-list">
            {importResult.errors.map((e, i) => (
              <div key={i} className="import-error-item">
                Row {e.rowIndex}: {e.error}
              </div>
            ))}
          </div>
          <button className="btn btn-sm btn-secondary" style={{marginTop: 'var(--space-md)'}} onClick={downloadFailedRows}>
            Download Failed Rows as CSV
          </button>
        </div>
      )}

      <div className="import-actions" style={{ marginTop: 'var(--space-xl)' }}>
        <button className="btn btn-primary btn-full" onClick={handleClose}>
          Done
        </button>
      </div>
    </div>
  );

  // Step indicator
  let stepText = '';
  if (step.startsWith('mapping') || step === 'preview') {
    if (isPersonal) {
      if (step === 'mapping-categories') stepText = 'Step 1 of 2: Map Categories';
      if (step === 'preview') stepText = 'Step 2 of 2: Preview';
    } else {
      if (step === 'mapping-people') stepText = 'Step 1 of 4: Map People';
      if (step === 'mapping-splits') stepText = 'Step 2 of 4: Map Splits';
      if (step === 'mapping-categories') stepText = 'Step 3 of 4: Map Categories';
      if (step === 'preview') stepText = 'Step 4 of 4: Preview';
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import CSV Data">
      {stepText && <div className="import-step-indicator">{stepText}</div>}
      
      {step === 'prereq' && renderPrereq()}
      {step === 'upload' && renderIdle()}
      {step === 'mapping-people' && renderMappingPeople()}
      {step === 'mapping-splits' && renderMappingSplits()}
      {step === 'mapping-categories' && renderMappingCategories()}
      {step === 'preview' && renderPreview()}
      {step === 'importing' && renderImporting()}
      {step === 'success' && renderSuccess()}
    </Modal>
  );
}
