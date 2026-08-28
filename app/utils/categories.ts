// Category utilities backed by the shared Convex database.
import { createConvexDatabase, type ConvexDatabase } from '../lib/convexDb';

const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
];

// Default colors for each category (one color per category)
const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  'Food': '#E23744',
  'Transport': '#000000',
  'Shopping': '#9B870C',
  'Bills': '#5F3DC4',
  'Entertainment': '#2F9E44',
  'Health': '#E8590C',
  'Other': '#868E96',
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

// Get categories from Supabase (with localStorage fallback)
export async function getCategories(): Promise<Category[]> {
  const username = getUsername();
  if (!username) {
    // Return defaults if no username
    return DEFAULT_CATEGORIES.map((name) => ({
      name,
      color: DEFAULT_CATEGORY_COLORS[name] || DEFAULT_CATEGORY_COLORS['Other'],
    }));
  }

  const supabase = getDatabase();
  
  // Try Supabase first
  if (supabase && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('username', username)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        // Sync to localStorage for offline access
        const categories = data.map((cat) => ({
          name: cat.name,
          color: cat.color,
          id: cat.id,
          display_order: cat.display_order,
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem(`categories_${username}`, JSON.stringify(categories));
        }
        return categories;
      }
    } catch (error) {
      console.error('Error fetching categories from Supabase:', error);
    }
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const storedCategories = localStorage.getItem(`categories_${username}`);
    if (storedCategories) {
      try {
        const parsed = JSON.parse(storedCategories);
        // Handle migration from old format
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof parsed[0] === 'string') {
            // Old format - migrate to new format
            const migrated = parsed.map((name: string) => ({
              name,
              color: DEFAULT_CATEGORY_COLORS[name] || DEFAULT_CATEGORY_COLORS['Other'],
            }));
            // Save migrated format
            localStorage.setItem(`categories_${username}`, JSON.stringify(migrated));
            // Try to sync to Supabase
            syncCategoriesToSupabase(migrated, username);
            return migrated;
          }
          return parsed;
        }
      } catch (error) {
        console.error('Error parsing stored categories:', error);
      }
    }
  }

  // Return defaults
  const defaults = DEFAULT_CATEGORIES.map((name) => ({
    name,
    color: DEFAULT_CATEGORY_COLORS[name] || DEFAULT_CATEGORY_COLORS['Other'],
  }));
  
  // Initialize defaults in Supabase
  if (supabase && navigator.onLine) {
    syncCategoriesToSupabase(defaults, username);
  }
  
  return defaults;
}

// Sync categories to Supabase
async function syncCategoriesToSupabase(categories: Category[], username: string) {
  const supabase = getDatabase();
  if (!supabase || !navigator.onLine) return;

  try {
    // Delete existing categories for this user
    await supabase.from('categories').delete().eq('username', username);

    // Insert new categories
    const categoriesToInsert = categories.map((cat, index) => ({
      username,
      name: cat.name,
      color: cat.color,
      display_order: index,
    }));

    if (categoriesToInsert.length > 0) {
      await supabase.from('categories').insert(categoriesToInsert);
    }
  } catch (error) {
    console.error('Error syncing categories to Supabase:', error);
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
