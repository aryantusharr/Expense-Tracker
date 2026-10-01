import { useMemo, useState } from 'react';
import { updateCategories } from '../../services/roomService';
import { generateId } from '../../utils/helpers';
import { haptic } from '../../utils/haptics';
import { CATEGORY_ICONS, resolveCategoryIcon } from '../../design/categoryIcons';
import CategoryIcon, { LineIcon } from '../ui/CategoryIcon';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';

const BIN = 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3';
const TEAR_MS = 600;

/** Categories card (boards S4a + S4c): icon rows with counts, bin + ⋮⋮ lift/swap, add/edit sheet. */
export default function CategoriesSection({ roomCode, categories, expenses }) {
  const toast = useToast();
  const [lift, setLift] = useState(null);       // id of the lifted category
  const [asking, setAsking] = useState(null);   // id showing the inline delete confirm
  const [tearing, setTearing] = useState(null); // id mid-tear
  const [fresh, setFresh] = useState(null);     // id of a just-added category (NEW tag)
  const [sheet, setSheet] = useState(null);     // null | { id|null, name, key }
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    const m = {};
    for (const e of expenses) if (e.categoryId) m[e.categoryId] = (m[e.categoryId] || 0) + 1;
    return m;
  }, [expenses]);

  const persist = list => updateCategories(roomCode, list).catch(err =>
    toast({ message: 'Couldn’t save categories', sub: String(err?.message || err), kind: 'error' }));

  const tapLift = cat => {
    haptic('choose');
    if (lift == null) { setLift(cat.id); return; }
    if (lift === cat.id) { setLift(null); return; }
    const a = categories.findIndex(c => c.id === lift);
    const b = categories.findIndex(c => c.id === cat.id);
    const next = [...categories];
    [next[a], next[b]] = [next[b], next[a]];
    setLift(null);
    persist(next);
  };

  const tearOff = cat => {
    haptic('error');
    setAsking(null);
    setTearing(cat.id);
    setTimeout(async () => {
      await persist(categories.filter(c => c.id !== cat.id));
      setTearing(null);
      toast({ message: <><b>{cat.name}</b> torn off</>, sub: counts[cat.id] ? `${counts[cat.id]} expenses now show under Other` : undefined, duration: 3200 });
    }, TEAR_MS);
  };

  const openAdd = () => { haptic('tap'); setSheet({ id: null, name: '', key: 'other' }); };
  const openEdit = cat => {
    haptic('tap');
    setSheet({ id: cat.id, name: cat.name, key: resolveCategoryIcon(cat).key });
  };
  const save = async () => {
    const name = sheet.name.trim();
    if (!name || saving) return;
    setSaving(true);
    const icon = `line:${sheet.key}`;
    if (sheet.id) {
      await persist(categories.map(c => (c.id === sheet.id ? { ...c, name, icon } : c)));
    } else {
      const id = generateId();
      await persist([...categories, { id, name, icon }]);
      setFresh(id);
    }
    haptic('success');
    setSaving(false);
    setSheet(null);
  };

  const row = cat => {
    const n = counts[cat.id] || 0;
    return (
      <div className="st-cat__row">
        <button type="button" className="st-cat__main" onClick={() => openEdit(cat)} aria-label={`Edit ${cat.name}`}>
          <CategoryIcon category={cat} size={32} />
          <span className="st-cat__txt">
            <span className="st-cat__name">{cat.name}</span>
            <span className={`st-mono ${fresh === cat.id ? 'st-teal' : ''}`}>{fresh === cat.id ? 'NEW · 0 EXPENSES' : `${n} ${n === 1 ? 'EXPENSE' : 'EXPENSES'}`}</span>
          </span>
        </button>
        <button type="button" className="st-cat__btn st-pink se-press" aria-label={`Delete ${cat.name}`}
          onClick={() => { haptic('tap'); setAsking(asking === cat.id ? null : cat.id); }}>
          <LineIcon path={BIN} size={15} strokeWidth={1.9} />
        </button>
        <button type="button" className="st-cat__btn st-cat__grip se-press" aria-label="Reorder" onClick={() => tapLift(cat)}>⋮⋮</button>
      </div>
    );
  };

  const picked = sheet ? CATEGORY_ICONS.find(i => i.key === sheet.key) : null;

  return (
    <>
      <div className="st-card se-glass st-cats">
        {categories.map(cat => (
          <div key={cat.id} className={`st-cat ${lift === cat.id ? 'is-lifted' : ''} ${tearing === cat.id ? 'is-tearing' : ''}`}>
            {tearing === cat.id ? (
              <>
                <div className="st-cat__half st-cat__half--top" aria-hidden="true">{row(cat)}</div>
                <div className="st-cat__half st-cat__half--bot" aria-hidden="true">{row(cat)}</div>
              </>
            ) : row(cat)}
            {asking === cat.id && (
              <div className="st-confirm se-pop">
                <b>Delete {cat.name}?</b>
                <span>{counts[cat.id] ? `${counts[cat.id]} expenses will show under Other.` : 'No expenses use it.'}</span>
                <div className="st-confirm__btns">
                  <button type="button" className="se-btn se-btn--secondary se-btn--sm se-press" onClick={() => setAsking(null)}>Keep it</button>
                  <button type="button" className="se-btn se-btn--sm st-del se-press" onClick={() => tearOff(cat)}>Tear it off</button>
                </div>
              </div>
            )}
          </div>
        ))}
        <button type="button" className="st-add se-press" onClick={openAdd}>+ Add category · {CATEGORY_ICONS.length} icons</button>
      </div>
      <span className="st-hint">{lift != null ? 'Now tap ⋮⋮ on another category to swap places' : 'Tap ⋮⋮ to lift a category · the bin removes it'}</span>

      <Sheet open={!!sheet} onClose={() => setSheet(null)} labelledBy="st-cat-title">
        {sheet && (
          <>
            <h2 className="se-sheet__title" id="st-cat-title">{sheet.id ? 'Edit category' : 'New category'}</h2>
            <label className="st-namefield" style={{ '--c': picked?.color }}>
              <span className="se-cat st-namefield__ic" style={{ '--c': picked?.color, '--size': '44px' }}><LineIcon path={picked?.path} size={22} /></span>
              <span className="st-namefield__col">
                <span className="st-mono">NAME</span>
                <input value={sheet.name} onChange={e => setSheet(s => ({ ...s, name: e.target.value }))} placeholder="Category name" maxLength={24} autoFocus={!sheet.id} />
              </span>
            </label>
            <span className="st-mono">PICK AN ICON · {CATEGORY_ICONS.length}</span>
            <div className="st-icons">
              {CATEGORY_ICONS.map(({ key, label, path, color }) => (
                <button key={key} type="button" aria-label={label} className={`st-icons__b se-press ${sheet.key === key ? 'is-on' : ''}`}
                  style={{ '--c': color }} onClick={() => { haptic('choose'); setSheet(s => ({ ...s, key })); }}>
                  <span className="se-cat" style={{ '--c': color, '--size': '46px' }}><LineIcon path={path} size={22} /></span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className="st-btnrow">
              <button type="button" className="se-btn se-btn--secondary se-press" onClick={() => setSheet(null)}>Cancel</button>
              <button type="button" className="se-btn se-btn--primary se-press" disabled={!sheet.name.trim() || saving} onClick={save}>
                {sheet.id ? 'Save changes' : 'Add category'}
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
