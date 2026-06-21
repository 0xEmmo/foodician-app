import { create } from 'zustand';
import { supabase } from '@/src/lib/supabase';

// ─── MENU (full array) ──────────────────────────────────────────────────────
export const MENU = [
  { id:1,  name:'Spaghetti + Chicken', desc:'Rich, peppered spaghetti with grilled chicken leg.',       price:3000, image:'https://images.unsplash.com/photo-1588013275177-319f3117f2fd?auto=format&fit=crop&w=300&q=80', mins:15, cat:'pasta'   },
  { id:2,  name:'Spaghetti + Turkey',  desc:'Slow-simmered tomato spaghetti with smoky turkey wings.',  price:3500, image:'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=300&q=80', mins:15, cat:'pasta'   },
  { id:3,  name:'Plain Spaghetti',     desc:'Classic seasoned local style spaghetti.',                  price:2000, image:'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80', mins:12, cat:'pasta'   },
  { id:4,  name:'Indomie Special',     desc:'Stir-fried noodles with egg, veggies & sardine.',          price:1200, image:'https://images.unsplash.com/photo-1612966608997-30041219b58e?auto=format&fit=crop&w=300&q=80', mins:7,  cat:'noodles' },
  { id:5,  name:'Indomie + Chicken',   desc:'Indomie with peppered fried chicken pieces.',              price:1800, image:'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=300&q=80', mins:10, cat:'noodles' },
  { id:6,  name:'Indomie + Turkey',    desc:'Seasoned noodles layered with fried native turkey.',       price:2200, image:'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=300&q=80', mins:10, cat:'noodles' },
  { id:7,  name:'Grilled Chicken',     desc:'Quarter chicken leg, hot pepper glaze.',                   price:2000, image:'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=300&q=80', mins:10, cat:'protein' },
  { id:8,  name:'Turkey Wings',        desc:'Oven-baked jumbo turkey wings, chili paste.',              price:2500, image:'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=300&q=80', mins:12, cat:'protein' },
  { id:9,  name:'Chips (Regular)',     desc:'Double-fried crisp French fries, spiced salt.',            price:800,  image:'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=300&q=80', mins:6,  cat:'sides'   },
  { id:10, name:'Chips + Chicken',     desc:'Crispy fries with 2-piece fried chicken.',                 price:2800, image:'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=300&q=80', mins:10, cat:'sides'   },
];

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type MenuItem = typeof MENU[number] & { image_url?: string };
export type Transaction = { type: 'credit' | 'debit'; amount: number; desc: string; time: string };

export type Order = {
  id?: string;
  code: string;
  mins: number;
  total: number;
  items: string[];
  time: string;
  status: string;
  customer: string;
  user_email?: string;
  payment_method?: string;
  order_type?: string;
  delivery_address?: string;
  order_notes?: string;
  user_name?: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  wallet: number;
  transactions: Transaction[];
  phone?: string;
  role?: string;
};

type AppStore = {
  sessionUser: SessionUser | null;
  setSessionUser: (user: SessionUser | null) => void;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any | null }>;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  logout: () => Promise<void>;
  initAuthListener: () => void;
  cart: Record<number, number>;
  changeQty: (id: number, delta: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
  cartMins: () => number | null;
  cartCount: () => number;
  orders: Order[];
  fetchOrders: () => Promise<void>;
  addOrder: (order: Omit<Order, 'id'>) => Promise<void>;
  addTransaction: (type: 'credit' | 'debit', amount: number, desc: string) => Promise<void>;
  topUpWallet: (amount: number) => Promise<void>;
  deductFromWallet: (amount: number, reason: string) => Promise<void>;
};

const logError = (msg: string, err: any) => console.error(msg, err?.message || err);

export const useAppStore = create<AppStore>()((set, get) => ({

  sessionUser: null,
  setSessionUser: (user) => set({ sessionUser: user }),

  signUp: async (email, password, username) => {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) return { error: signUpError };
    if (!authData.user) return { error: new Error('User creation failed') };
    const { error: insertError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      email,
      name: username,
      wallet: 0,
      transactions: [],
    });
    if (insertError) return { error: insertError };
    return { error: null };
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ sessionUser: null, orders: [], cart: {} });
  },

  initAuthListener: () => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        let { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') {
          logError('Fetch profile error:', error);
          return;
        }
        if (!profile) {
          const defaultName = session.user.email?.split('@')[0] || 'User';
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email!,
              name: defaultName,
              wallet: 0,
              transactions: [],
            })
            .select()
            .maybeSingle();
          if (insertError) {
            logError('Insert profile error:', insertError);
            return;
          }
          profile = newProfile;
        }
        if (profile) {
          set({
            sessionUser: {
              id: profile.id,
              name: profile.name,
              email: profile.email,
              wallet: profile.wallet ?? 0,
              transactions: profile.transactions ?? [],
              phone: profile.phone ?? undefined,
              role: profile.role ?? 'user',
            },
          });
          await get().fetchOrders();
        }
      } else {
        set({ sessionUser: null, orders: [], cart: {} });
      }
    });
  },

  // ── Cart ─────────────────────────────────────────────────────────────────
  cart: {},
  changeQty: (id, delta) => set((state) => {
    const updated = { ...state.cart };
    updated[id] = (updated[id] ?? 0) + delta;
    if (updated[id] <= 0) delete updated[id];
    return { cart: updated };
  }),
  clearCart: () => set({ cart: {} }),
  cartTotal: () => {
    const { cart } = get();
    return Object.keys(cart).reduce((sum, id) => {
      const item = MENU.find(m => m.id === Number(id));
      return sum + (item ? item.price * cart[Number(id)] : 0);
    }, 0);
  },
  cartMins: () => {
    const { cart } = get();
    const ids = Object.keys(cart).map(Number);
    if (!ids.length) return null;
    return Math.max(...ids.map(id => MENU.find(m => m.id === id)?.mins ?? 10)) + 3;
  },
  cartCount: () => Object.values(get().cart).reduce((a, b) => a + b, 0),

  // ── Orders ───────────────────────────────────────────────────────────────
  orders: [],
  fetchOrders: async () => {
    const { sessionUser } = get();
    if (!sessionUser?.email) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_name', sessionUser.name)
        .order('created_at', { ascending: false });
      if (error) {
        logError('Fetch orders error:', error);
        return;
      }
      const mapped: Order[] = (data ?? []).map(o => ({
        id: o.id,
        code: o.verification_code,
        mins: 15,
        total: o.total_amount,
        items: Array.isArray(o.items) ? o.items : [],
        time: new Date(o.created_at).toLocaleTimeString(),
        status: o.status,
        customer: o.user_name,
        user_email: o.user_email,
        payment_method: o.payment_method,
      }));
      set({ orders: mapped });
    } catch (err) {
      console.error('Unexpected error fetching orders:', err);
    }
  },

  addOrder: async (order) => {
    const { sessionUser } = get();
    set(state => ({ orders: [order as Order, ...state.orders] }));
    if (!sessionUser?.email) return;
    try {
      const { error } = await supabase.from('orders').insert({
        user_name: order.customer,
        user_email: order.user_email || sessionUser.email,
        verification_code: order.code,
        total_amount: order.total,
        status: 'Confirmed',
        items: order.items,
        payment_method: order.payment_method || 'unknown',
        created_at: new Date().toISOString(),
      });
      if (error) logError('Insert order error:', error);
    } catch (err) {
      console.error('Error saving order:', err);
    }
  },

  // ── Wallet ───────────────────────────────────────────────────────────────
  addTransaction: async (type, amount, desc) => {
    const { sessionUser } = get();
    if (!sessionUser) return;
    const newTx: Transaction = { type, amount, desc, time: new Date().toLocaleString() };
    const newWallet = type === 'credit' ? sessionUser.wallet + amount : sessionUser.wallet - amount;
    const newTransactions = [newTx, ...sessionUser.transactions];
    set({ sessionUser: { ...sessionUser, wallet: newWallet, transactions: newTransactions } });
    try {
      await supabase
        .from('profiles')
        .update({ wallet: newWallet, transactions: newTransactions, updated_at: new Date().toISOString() })
        .eq('id', sessionUser.id);
    } catch (err) {
      console.error('Error updating wallet:', err);
    }
  },
  topUpWallet: async (amount) => { if (amount > 0) await get().addTransaction('credit', amount, 'Wallet top-up'); },
  deductFromWallet: async (amount, reason) => {
    if (amount <= 0) return;
    const { sessionUser } = get();
    if (!sessionUser || sessionUser.wallet < amount) return;
    await get().addTransaction('debit', amount, reason);
  },
}));