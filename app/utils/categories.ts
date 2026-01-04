// Default categories
const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
];

const STORAGE_KEY = 'expense_categories';

/**
 * Get categories from localStorage or return defaults
 */
export function getCategories(): string[] {
  if (typeof window === 'undefined') {
    return DEFAULT_CATEGORIES;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }

  // Initialize with defaults if not found
  setCategories(DEFAULT_CATEGORIES);
  return DEFAULT_CATEGORIES;
}

/**
 * Save categories to localStorage
 */
export function setCategories(categories: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
    // Dispatch event for other components to update
    window.dispatchEvent(new CustomEvent('categoriesUpdated'));
  } catch (error) {
    console.error('Error saving categories:', error);
  }
}

/**
 * Add a new category
 */
export function addCategory(category: string): void {
  const categories = getCategories();
  if (!categories.includes(category.trim())) {
    setCategories([...categories, category.trim()]);
  }
}

/**
 * Update a category name
 */
export function updateCategory(oldName: string, newName: string): void {
  const categories = getCategories();
  const index = categories.indexOf(oldName);
  if (index !== -1 && !categories.includes(newName.trim())) {
    const updated = [...categories];
    updated[index] = newName.trim();
    setCategories(updated);
  }
}

/**
 * Remove a category
 */
export function removeCategory(category: string): void {
  const categories = getCategories();
  setCategories(categories.filter((c) => c !== category));
}

/**
 * Reorder categories
 */
export function reorderCategories(fromIndex: number, toIndex: number): void {
  const categories = getCategories();
  const updated = [...categories];
  const [moved] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, moved);
  setCategories(updated);
}

/**
 * Reset to default categories
 */
export function resetCategories(): void {
  setCategories(DEFAULT_CATEGORIES);
}

