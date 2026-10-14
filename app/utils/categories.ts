// Category utilities backed by the shared Convex database.
import { createConvexDatabase, type ConvexDatabase } from '../lib/convexDb';

export type CategoryKind = 'expense' | 'income';

const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  // Money sent that is a loan -- lending to someone, or repaying one.
  'Loan',
  'Other',
];

// Money coming in. 'Loan' appears on both sides on purpose: borrowing from
// someone is income, and sending it back out is an expense.
export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Loan',
  'Pocket money',
  'Refund',
  'Other income',
];

// Default colors for each category (one color per category)
const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  'Food': '#E23744',
  'Transport': '#000000',
  'Shopping': '#9B870C',
  'Bills': '#5F3DC4',
  'Entertainment': '#2F9E44',
  'Health': '#E8590C',
  'Loan': '#1971C2',
  'Other': '#868E96',
  'Salary': '#2F9E44',
  'Pocket money': '#F59F00',
  'Refund': '#0CA678',
  'Other income': '#868E96',
};

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
  id?: string;
  name: string;
  color: string;
  display_order?: number;
  /** Absent means 'expense' -- every category saved before income existed. */
  kind?: CategoryKind;
}

/** Rows written before income tracking have no `kind`; they are all expenses. */
export const kindOf = (row: { kind?: string | null }): CategoryKind =>
  row.kind === 'income' ? 'income' : 'expense';

export function defaultsFor(kind: CategoryKind): Category[] {
  const names = kind === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_CATEGORIES;
  return names.map((name) => ({
    name,
    kind,
    color: DEFAULT_CATEGORY_COLORS[name] || DEFAULT_CATEGORY_COLORS['Other'],
  }));
}

function getDatabase(): ConvexDatabase | null {
  if (typeof window === 'undefined') return null;
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return null;
  return createConvexDatabase();
}

// Get username from localStorage
function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('username');
}

function dispatchCategoriesUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('categoriesUpdated'));
  }
}

// Get categories from Supabase (with localStorage fallback).
// `kind` splits the single table into the expense list and the income list;
// rows saved before income tracking have no `kind` and read as expenses.
export async function getCategories(kind: CategoryKind = 'expense'): Promise<Category[]> {
  const username = getUsername();
  const storageKey = kind === 'income' ? `categories_income_${username}` : `categories_${username}`;

  if (!username) return defaultsFor(kind);

  const supabase = getDatabase();

  if (supabase && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('username', username)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (!error && data) {
        const mine = data.filter((cat) => kindOf(cat) === kind);
        if (mine.length > 0) {
          const categories = mine.map((cat) => ({
            name: cat.name,
            color: cat.color,
            id: cat.id,
            display_order: cat.display_order,
            kind,
          }));
          if (typeof window !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(categories));
          }
          return categories;
        }
        // No rows of this kind yet. Seed them without touching the other kind.
        const seeded = defaultsFor(kind);
        seedCategories(seeded, username, kind);
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(seeded));
        }
        return seeded;
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof parsed[0] === 'string') {
            const migrated = parsed.map((name: string) => ({
              name,
              kind,
              color: DEFAULT_CATEGORY_COLORS[name] || DEFAULT_CATEGORY_COLORS['Other'],
            }));
            localStorage.setItem(storageKey, JSON.stringify(migrated));
            return migrated;
          }
          return parsed;
        }
      } catch (error) {
        console.error('Error parsing stored categories:', error);
      }
    }
  }

  return defaultsFor(kind);
}

/** Insert missing categories for one kind. Never deletes anything. */
async function seedCategories(categories: Category[], username: string, kind: CategoryKind) {
  const supabase = getDatabase();
  if (!supabase || !navigator.onLine) return;
  try {
    await supabase.from('categories').insert(
      categories.map((cat, index) => ({
        username,
        name: cat.name,
        color: cat.color,
        display_order: index,
        kind,
      }))
    );
  } catch (error) {
    console.error('Error seeding categories:', error);
  }
}

// Replace the categories of ONE kind.
//
// The previous version deleted every category for the user and reinserted,
// which would silently destroy the income list every time the expense list
// was saved. Deletion is now scoped to the rows of the kind being replaced,
// matched by id -- a `.eq('kind', 'expense')` filter would miss the legacy
// rows that predate the field and have no `kind` at all.
async function syncCategoriesToSupabase(
  categories: Category[],
  username: string,
  kind: CategoryKind = 'expense'
) {
  const supabase = getDatabase();
  if (!supabase || !navigator.onLine) return;

  try {
    const { data: existing } = await supabase
      .from('categories')
      .select('*')
      .eq('username', username);

    for (const row of existing || []) {
      if (kindOf(row) !== kind || !row.id) continue;
      await supabase.from('categories').delete().eq('id', row.id);
    }

    const toInsert = categories.map((cat, index) => ({
      username,
      name: cat.name,
      color: cat.color,
      display_order: index,
      kind,
    }));
    if (toInsert.length > 0) {
      await supabase.from('categories').insert(toInsert);
    }
  } catch (error) {
    console.error('Error syncing categories:', error);
  }
}

// Get category names (synchronous version for compatibility)
export function getCategoryNames(): string[] {
  // This is a synchronous function, so we'll use localStorage as fallback
  const username = getUsername();
  if (!username) {
    return DEFAULT_CATEGORIES;
  }

  if (typeof window !== 'undefined') {
    const storedCategories = localStorage.getItem(`categories_${username}`);
    if (storedCategories) {
      try {
        const parsed = JSON.parse(storedCategories);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof parsed[0] === 'string') {
            return parsed;
          }
          return parsed.map((cat: Category) => cat.name);
        }
      } catch (error) {
        console.error('Error parsing stored categories:', error);
      }
    }
  }

  return DEFAULT_CATEGORIES;
}

export async function setCategories(categories: Category[]) {
  const username = getUsername();
  if (!username) return;

  // Save to localStorage immediately for instant UI update
  if (typeof window !== 'undefined') {
    localStorage.setItem(`categories_${username}`, JSON.stringify(categories));
  }

  // Sync to Supabase
  await syncCategoriesToSupabase(categories, username);
  
  dispatchCategoriesUpdate();
}

export async function addCategory(category: Category) {
  const currentCategories = await getCategories();
  if (!currentCategories.some((cat) => cat.name.toLowerCase() === category.name.toLowerCase())) {
    await setCategories([...currentCategories, category]);
  }
}

export async function updateCategory(oldCategory: Category, newCategory: Category) {
  const currentCategories = await getCategories();
  const updatedCategories = currentCategories.map((cat) =>
    cat.name === oldCategory.name ? newCategory : cat
  );
  await setCategories(updatedCategories);
}

export async function updateCategoryName(oldName: string, newName: string) {
  const currentCategories = await getCategories();
  const updatedCategories = currentCategories.map((cat) =>
    cat.name === oldName ? { ...cat, name: newName } : cat
  );
  await setCategories(updatedCategories);
}

export async function updateCategoryColor(categoryName: string, color: string) {
  const currentCategories = await getCategories();
  const updatedCategories = currentCategories.map((cat) =>
    cat.name === categoryName ? { ...cat, color } : cat
  );
  await setCategories(updatedCategories);
}

export async function removeCategory(categoryName: string) {
  const currentCategories = await getCategories();
  const updatedCategories = currentCategories.filter((cat) => cat.name !== categoryName);
  await setCategories(updatedCategories);
}

export async function reorderCategories(startIndex: number, endIndex: number) {
  const currentCategories = await getCategories();
  const result = Array.from(currentCategories);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  await setCategories(result);
}

export async function resetCategories() {
  const username = getUsername();
  if (!username) return;

  const supabase = getDatabase();
  if (supabase && navigator.onLine) {
    try {
      await supabase.from('categories').delete().eq('username', username);
    } catch (error) {
      console.error('Error resetting categories in Supabase:', error);
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem(`categories_${username}`);
  }

  dispatchCategoriesUpdate();
}

export function getCategoryColor(categoryName: string): string {
  // Synchronous version using localStorage
  const username = getUsername();
  if (!username) return PRESET_COLORS[0];

  if (typeof window !== 'undefined') {
    const storedCategories = localStorage.getItem(`categories_${username}`);
    if (storedCategories) {
      try {
        const parsed = JSON.parse(storedCategories);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof parsed[0] === 'string') {
            // Old format - use default category colors
            return DEFAULT_CATEGORY_COLORS[categoryName] || DEFAULT_CATEGORY_COLORS['Other'];
          }
          const category = parsed.find((cat: Category) => cat.name === categoryName);
          return category?.color || PRESET_COLORS[0];
        }
      } catch (error) {
        console.error('Error parsing stored categories:', error);
      }
    }
  }

  return PRESET_COLORS[0];
}
