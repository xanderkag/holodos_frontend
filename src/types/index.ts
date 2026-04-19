export type Category = string;

export interface Store {
  name: string;
  ord: Category[];
}

export interface Item {
  id: string;
  name: string;
  cat: Category;
  notes?: string;
  isChecked?: boolean;
  qty?: string | null;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  updatedAt?: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown';
export type VoiceIntent = 'product_action' | 'food_diary' | 'stock_analysis';

export interface StockTaggedItem {
  name: string;
  tag: 'low_stock' | 'expiring_soon' | 'maybe_finished';
  reason: string;
}

export interface DiaryEntry extends Item {
  consumedAt: number;
  mealType?: MealType;
  // AI-added entry fields
  source?: 'voice' | 'photo' | 'manual';
  sourceTranscript?: string;
  chatMessageId?: string;
  needsClarification?: boolean;
  clarificationField?: 'quantity' | 'unit' | 'name' | 'calories';
  clarificationHint?: string;
  confidence?: number;
}

export interface Ingredient {
  name: string;
  quantity: string;
  category: Category;
  notes?: string;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}

export interface RecipeVariant {
  label: string;
  ingredients: Ingredient[];
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  portions: number;
  variants: RecipeVariant[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  type?: string;
  isUndoable?: boolean;
  type_info?: 'info' | 'success' | 'error' | 'undo';
  actions?: AiAction[];
  suggestions?: AiSuggestion[];
  // Diary AI message fields
  diaryEntryId?: string;
  diarySource?: 'voice' | 'photo';
  diaryTranscript?: string;
  // Stock analysis message fields
  stockTaggedItems?: StockTaggedItem[];
}

export interface UiSettings {
  density: 'comfortable' | 'compact';
  theme: 'system' | 'modern' | 'simple' | 'accent' | 'apple' | 'dark';
}

export interface VoiceLog {
  id: string;
  text: string;
  status: 'info' | 'success' | 'error';
  timestamp: number;
}

export interface UsageStats {
  d: number; // Day
  m: number; // Month
  t: number; // Total
}

export interface LogEvent {
  id: string;
  text: string;
  type: 'add' | 'remove' | 'move' | 'log' | 'check' | 'uncheck' | 'ai';
  timestamp: number;
}

export interface UserData {
  list: Item[];
  stock: Item[];
  baseline: Item[];
  stores: Store[];
  myRecipes: Recipe[];
  messages: Message[];
  voiceLogs: VoiceLog[];
  uiSettings: UiSettings;
  calorieNorm?: number;
  macroNorms?: { protein: number; fat: number; carbs: number };
  diary?: DiaryEntry[];
  events?: LogEvent[];
  isSubscribed?: boolean;
  subscriptionStatus?: 'free' | 'active' | 'expired' | 'canceled';
  subscriptionType?: 'free' | 'pro';
  subscriptionEndDate?: number; // timestamp
  stats?: {
    voice: UsageStats;
    chat: UsageStats;
    image: UsageStats;
  };
  telegramId?: number;
  telegramHandle?: string;
  email?: string;
  lastStatsReset?: {
    d: string; // YYYY-MM-DD
    m: string; // YYYY-MM
  };
}

export interface AiAction {
  type: 'add' | 'remove' | 'move' | 'check' | 'uncheck' | 'remove_all' | 'noop' | 'skip';
  target?: 'list' | 'stock' | 'baseline' | 'diary';
  from?: 'list' | 'stock' | 'baseline' | 'diary';
  to?: 'list' | 'stock' | 'baseline' | 'diary';
  items?: Partial<Item>[];
  feedback?: string;
  reason?: string;
  applied?: boolean;
}

export interface AiOption {
  label: string;
  action: AiAction;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface AiSuggestion {
  id: string;
  text?: string;
  options: AiOption[];
}

export interface AiResponse {
  actions: AiAction[];
  feedback: string;
  suggestions?: AiSuggestion[];
  requiresConfirmation?: boolean;
  type?: string;
  intent?: VoiceIntent;
  source?: 'voice' | 'photo' | 'text';
  // stock_analysis branch
  tagged_items?: StockTaggedItem[];
  analysis_tags?: ('low_stock' | 'expiring_soon' | 'maybe_finished')[];
  // backend subscription snapshot
  subscription?: any;
}
