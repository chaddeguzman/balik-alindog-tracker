import { useState, type FormEvent } from 'react'
import {
  addFoodLibraryEntry,
  createFoodLibraryEntry,
  deleteFoodLibraryEntry,
  findDuplicateFoodEntry,
  updateFoodLibraryEntry,
} from '../lib/storage'
import type { AppState, FoodCategory, FoodLibraryEntry, MealType } from '../types'

interface FoodLibraryInput {
  food: string
  category: FoodCategory
  calories: number
  proteinGrams?: number
  carbsGrams?: number
  weightGrams: number
  mealType: MealType
  remarks?: string
}

const CATEGORY_LABELS: Record<FoodCategory, string> = {
  food: 'Food',
  drinks: 'Drinks',
  supplement: 'Supplement',
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  flexible: 'Flexible',
}

const SERVING_UNIT_LABELS: Record<FoodCategory, string> = {
  food: 'g',
  drinks: 'mL',
  supplement: 'pc',
}

const SERVING_FIELD_LABELS: Record<FoodCategory, string> = {
  food: 'Weight (grams)',
  drinks: 'Volume (mL)',
  supplement: 'Serving count (pc)',
}

function FoodEntryForm({
  entries,
  entry,
  onSave,
  onCancel,
}: {
  entries: FoodLibraryEntry[]
  entry?: FoodLibraryEntry
  onSave: (input: FoodLibraryInput) => void
  onCancel: () => void
}) {
  const [food, setFood] = useState(entry?.food ?? '')
  const [category, setCategory] = useState<FoodCategory>(entry?.category ?? 'food')
  const [calories, setCalories] = useState(entry?.calories.toString() ?? '')
  const [proteinGrams, setProteinGrams] = useState(entry?.proteinGrams?.toString() ?? '')
  const [carbsGrams, setCarbsGrams] = useState(entry?.carbsGrams?.toString() ?? '')
  const [weightGrams, setWeightGrams] = useState(entry?.weightGrams.toString() ?? '')
  const [mealType, setMealType] = useState<MealType>(entry?.mealType ?? 'flexible')
  const [remarks, setRemarks] = useState(entry?.remarks ?? '')
  const [duplicate, setDuplicate] = useState<FoodLibraryEntry | null>(null)
  const servingUnit = SERVING_UNIT_LABELS[category]

  function currentInput(): FoodLibraryInput {
    return {
      food,
      category,
      calories: Number(calories),
      proteinGrams: proteinGrams === '' ? undefined : Number(proteinGrams),
      carbsGrams: carbsGrams === '' ? undefined : Number(carbsGrams),
      weightGrams: Number(weightGrams),
      mealType,
      remarks,
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const input = currentInput()
    const match = findDuplicateFoodEntry(entries, input, entry?.id)
    if (match) {
      setDuplicate(match)
      return
    }
    onSave(input)
  }

  if (duplicate) {
    return (
      <div className="confirmation">
        <div className="notice warning">
          <strong>Possible duplicate food</strong>
          <span>{duplicate.food} already exists at {duplicate.weightGrams.toLocaleString()} {SERVING_UNIT_LABELS[duplicate.category]}. You can still add this entry.</span>
        </div>
        <dl className="confirmation-list">
          <div><dt>Food</dt><dd>{food.trim()}</dd></div>
          <div><dt>Serving</dt><dd>{Number(weightGrams).toLocaleString()} {servingUnit}</dd></div>
          <div><dt>Calories</dt><dd>{Number(calories).toLocaleString()} kcal</dd></div>
          <div><dt>Protein</dt><dd>{proteinGrams === '' ? '-' : `${Number(proteinGrams).toLocaleString()} g`}</dd></div>
          <div><dt>Carbs</dt><dd>{carbsGrams === '' ? '-' : `${Number(carbsGrams).toLocaleString()} g`}</dd></div>
        </dl>
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={() => setDuplicate(null)}>Cancel</button>
          <button className="button primary" type="button" onClick={() => onSave(currentInput())}>Add Anyway</button>
        </div>
      </div>
    )
  }

  return (
    <form className="form-stack food-entry-form" onSubmit={submit}>
      <p className="helper-text">Calories describe the entered serving size and scale proportionally for food suggestions.</p>
      <label>
        Food
        <input autoFocus required maxLength={100} value={food} onChange={(event) => setFood(event.target.value)} />
      </label>
      <div className="form-grid">
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value as FoodCategory)}>
            <option value="food">Food</option>
            <option value="drinks">Drinks</option>
            <option value="supplement">Supplement</option>
          </select>
        </label>
        <label>
          Meal Type
          <select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
            <option value="flexible">Flexible</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Calorie
          <input type="number" inputMode="decimal" required min="0" max="100000" step="0.1" value={calories} onChange={(event) => setCalories(event.target.value)} />
        </label>
        <label>
          {SERVING_FIELD_LABELS[category]}
          <input type="number" inputMode="decimal" required min="0.1" max="100000" step="0.1" value={weightGrams} onChange={(event) => setWeightGrams(event.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Protein (grams) <span className="optional">Optional</span>
          <input type="number" inputMode="decimal" min="0" max="100000" step="0.1" value={proteinGrams} onChange={(event) => setProteinGrams(event.target.value)} />
        </label>
        <label>
          Carbs (grams) <span className="optional">Optional</span>
          <input type="number" inputMode="decimal" min="0" max="100000" step="0.1" value={carbsGrams} onChange={(event) => setCarbsGrams(event.target.value)} />
        </label>
      </div>
      <label>
        Remarks <span className="optional">Optional</span>
        <textarea rows={3} maxLength={500} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
      </label>
      <div className="form-actions">
        <button className="button secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="button primary" type="submit">{entry ? 'Save Changes' : 'Add Food'}</button>
      </div>
    </form>
  )
}

export function CalorieTracker({
  state,
  setState,
  notify,
}: {
  state: AppState
  setState: (state: AppState) => void
  notify: (message: string) => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FoodLibraryEntry | null>(null)
  const sortedEntries = [...state.foodLibrary].sort((a, b) => a.food.localeCompare(b.food))

  function saveNewEntry(input: FoodLibraryInput) {
    try {
      setState(addFoodLibraryEntry(state, createFoodLibraryEntry(input)))
      setAddOpen(false)
      notify('Food added to the household library.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add the food entry.')
    }
  }

  function saveEditedEntry(input: FoodLibraryInput) {
    if (!editingEntry) return
    try {
      setState(updateFoodLibraryEntry(state, editingEntry.id, input))
      setEditingEntry(null)
      notify('Food entry updated.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the food entry.')
    }
  }

  function removeEntry(entry: FoodLibraryEntry) {
    if (!window.confirm(`Delete ${entry.food} from the shared household food library?`)) return
    try {
      setState(deleteFoodLibraryEntry(state, entry.id))
      notify('Food entry deleted.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete the food entry.')
    }
  }

  return (
    <section className="calorie-tracker" aria-labelledby="calorie-tracker-title">
      <div className="calorie-tracker-heading">
        <div>
          <p className="eyebrow">Shared household library</p>
          <h1 id="calorie-tracker-title">Calorie Tracker</h1>
          <p>Save common foods once so every household member and the wellness coach can reuse them.</p>
        </div>
        <button className="button primary" type="button" onClick={() => setAddOpen(true)}>Add Food</button>
      </div>

      {sortedEntries.length ? (
        <section className="card food-library-card" aria-label="Saved foods">
          <div className="food-library-summary">
            <div>
              <p className="eyebrow">Food library</p>
              <h2>{sortedEntries.length} saved item{sortedEntries.length === 1 ? '' : 's'}</h2>
            </div>
            <span>Available to all household profiles</span>
          </div>
          <div className="table-scroll">
            <table className="food-library-table">
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Category</th>
                  <th>Calorie</th>
                  <th>Protein</th>
                  <th>Carbs</th>
                  <th>Serving</th>
                  <th>Meal Type</th>
                  <th>Remarks</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td><strong>{entry.food}</strong></td>
                    <td><span className="food-label">{CATEGORY_LABELS[entry.category]}</span></td>
                    <td>{entry.calories.toLocaleString()} kcal</td>
                    <td>{entry.proteinGrams === undefined ? '-' : `${entry.proteinGrams.toLocaleString()} g`}</td>
                    <td>{entry.carbsGrams === undefined ? '-' : `${entry.carbsGrams.toLocaleString()} g`}</td>
                    <td>{entry.weightGrams.toLocaleString()} {SERVING_UNIT_LABELS[entry.category]}</td>
                    <td>{MEAL_TYPE_LABELS[entry.mealType]}</td>
                    <td className="food-remarks">{entry.remarks || '-'}</td>
                    <td>
                      <div className="table-actions">
                        <button className="button compact secondary" type="button" onClick={() => setEditingEntry(entry)}>Edit</button>
                        <button className="button compact danger" type="button" onClick={() => removeEntry(entry)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="food-library-empty">
          <p className="eyebrow">Food library</p>
          <h2>No foods saved yet</h2>
          <p>Add a common food, drink, or supplement to make it available across the household.</p>
          <button className="button secondary" type="button" onClick={() => setAddOpen(true)}>Add the first food</button>
        </section>
      )}

      {addOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAddOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="food-modal-title">
            <div className="modal-header">
              <h2 id="food-modal-title">Add Food</h2>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setAddOpen(false)}>&times;</button>
            </div>
            <FoodEntryForm entries={state.foodLibrary} onSave={saveNewEntry} onCancel={() => setAddOpen(false)} />
          </section>
        </div>
      )}

      {editingEntry && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditingEntry(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="food-edit-modal-title">
            <div className="modal-header">
              <h2 id="food-edit-modal-title">Edit Food</h2>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setEditingEntry(null)}>&times;</button>
            </div>
            <FoodEntryForm entries={state.foodLibrary} entry={editingEntry} onSave={saveEditedEntry} onCancel={() => setEditingEntry(null)} />
          </section>
        </div>
      )}
    </section>
  )
}
