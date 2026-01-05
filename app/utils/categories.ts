// Category utilities with color support
const CATEGORIES_STORAGE_KEY = 'expenza_categories';
const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
];

// Preset aesthetic colors
export const PRESET_COLORS = [
  '#FF6B6B', // Red
  '#FF8E53', // Orange
  '#FFA94D', // Gold
  '#51CF66', // Green
  '#4DABF7', // Blue
  '#9775FA', // Purple
  '#F06595', // Pink
  '#20C997', // Teal
  '#FFD43B', // Yellow
  '#845EF7', // Indigo
  '#FD7E14', // Deep Orange
  '#E64980', // Rose
];

export interface Category {
  name: string;
  color: string;
}

function dispatchCategoriesUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('categoriesUpdated'));
  }
}

export function getCategories(): Category[] {
  if (typeof window === 'undefined') {
    return DEFAULT_CATEGORIES.map((name) => ({ name, color: PRESET_COLORS[0] }));
  }
  const storedCategories = localStorage.getItem(CATEGORIES_STORAGE_KEY);
  if (storedCategories) {
    const parsed = JSON.parse(storedCategories);
    // Handle migration from string array to Category array
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === 'string') {
        // Old format - migrate to new format
        const migrated = parsed.map((name: string, index: number) => ({
          name,
          color: PRESET_COLORS[index % PRESET_COLORS.length],
        }));
        setCategories(migrated);
        return migrated;
      }
      return parsed;
    }
  }
  // Return default categories with colors
  return DEFAULT_CATEGORIES.map((name, index) => ({
    name,
    color: PRESET_COLORS[index % PRESET_COLORS.length],
  }));
}

export function getCategoryNames(): string[] {
  return getCategories().map((cat) => cat.name);
}

export function setCategories(categories: Category[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    dispatchCategoriesUpdate();
  }
}

export function addCategory(category: Category) {
  const currentCategories = getCategories();
  if (!currentCategories.some((cat) => cat.name.toLowerCase() === category.name.toLowerCase())) {
    setCategories([...currentCategories, category]);
  }
}

export function updateCategory(oldCategory: Category, newCategory: Category) {
  const currentCategories = getCategories();
  const updatedCategories = currentCategories.map((cat) =>
    cat.name === oldCategory.name ? newCategory : cat
  );
  setCategories(updatedCategories);
}

export function updateCategoryName(oldName: string, newName: string) {
  const currentCategories = getCategories();
  const oldCategory = currentCategories.find((cat) => cat.name === oldName);
  if (oldCategory) {
    const updatedCategories = currentCategories.map((cat) =>
      cat.name === oldName ? { ...cat, name: newName } : cat
    );
    setCategories(updatedCategories);
  }
}

export function updateCategoryColor(categoryName: string, color: string) {
  const currentCategories = getCategories();
  const updatedCategories = currentCategories.map((cat) =>
    cat.name === categoryName ? { ...cat, color } : cat
  );
  setCategories(updatedCategories);
}

export function removeCategory(categoryName: string) {
  const currentCategories = getCategories();
  const updatedCategories = currentCategories.filter((cat) => cat.name !== categoryName);
  setCategories(updatedCategories);
}

export function reorderCategories(startIndex: number, endIndex: number) {
  const currentCategories = getCategories();
  const result = Array.from(currentCategories);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  setCategories(result);
}

export function resetCategories() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CATEGORIES_STORAGE_KEY);
    dispatchCategoriesUpdate();
  }
}

export function getCategoryColor(categoryName: string): string {
  const categories = getCategories();
  const category = categories.find((cat) => cat.name === categoryName);
  return category?.color || PRESET_COLORS[0];
}
