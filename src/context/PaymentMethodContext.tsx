import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type PaymentMethodId =
  | "tunai"
  | "qris"
  | "transfer"
  | "gopay"
  | "dana";

export type PaymentMethodConfig = {
  id:             PaymentMethodId;
  label:          string;
  icon:           string;
  enabled:        boolean;
  accountName?:   string;
  accountNumber?: string;
  bankName?:      string;
  note?:          string;
  qrisImageUri?:  string; // ✅ URI foto QRIS asli dari galeri
};

const DEFAULT_METHODS: PaymentMethodConfig[] = [
  { id: "tunai",    label: "Tunai",         icon: "💵", enabled: true  },
  { id: "qris",     label: "QRIS",          icon: "📱", enabled: false },
  { id: "transfer", label: "Transfer Bank", icon: "🏦", enabled: false },
  { id: "gopay",    label: "GoPay",         icon: "🟢", enabled: false },
  { id: "dana",     label: "DANA",          icon: "🔵", enabled: false },
];

const STORAGE_KEY = "@twd_payment_methods";

type PaymentMethodContextType = {
  methods:        PaymentMethodConfig[];
  enabledMethods: PaymentMethodConfig[];
  isLoading:      boolean;
  updateMethod:   (id: PaymentMethodId, updates: Partial<PaymentMethodConfig>) => Promise<void>;
  toggleMethod:   (id: PaymentMethodId, enabled: boolean) => Promise<void>;
};

const PaymentMethodContext = createContext<PaymentMethodContextType>({
  methods:        DEFAULT_METHODS,
  enabledMethods: DEFAULT_METHODS.filter(m => m.enabled),
  isLoading:      true,
  updateMethod:   async () => {},
  toggleMethod:   async () => {},
});

export function PaymentMethodProvider({ children }: { children: React.ReactNode }) {
  const [methods,   setMethods]   = useState<PaymentMethodConfig[]>(DEFAULT_METHODS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: PaymentMethodConfig[] = JSON.parse(stored);
          const merged = DEFAULT_METHODS.map(def => {
            const found = parsed.find(p => p.id === def.id);
            return found ? { ...def, ...found } : def;
          });
          setMethods(merged);
        }
      } catch {
        // gunakan default
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const save = async (updated: PaymentMethodConfig[]) => {
    setMethods(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const updateMethod = useCallback(async (
    id:      PaymentMethodId,
    updates: Partial<PaymentMethodConfig>,
  ) => {
    const updated = methods.map(m =>
      m.id === id ? { ...m, ...updates } : m,
    );
    await save(updated);
  }, [methods]);

  const toggleMethod = useCallback(async (
    id:      PaymentMethodId,
    enabled: boolean,
  ) => {
    if (id === "tunai") return;
    const updated = methods.map(m =>
      m.id === id ? { ...m, enabled } : m,
    );
    await save(updated);
  }, [methods]);

  const enabledMethods = methods.filter(m => m.enabled);

  const contextValue: PaymentMethodContextType = {
    methods,
    enabledMethods,
    isLoading,
    updateMethod,
    toggleMethod,
  };

  return (
    <PaymentMethodContext.Provider value={contextValue}>
      {children}
    </PaymentMethodContext.Provider>
  );
}

export function usePaymentMethods(): PaymentMethodContextType {
  return useContext(PaymentMethodContext);
}