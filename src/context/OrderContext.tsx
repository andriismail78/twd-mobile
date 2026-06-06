// src/context/OrderContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY_ORDERS = "@twd_orders";

// Types
export type OrderStatus =
  | "menunggu"
  | "dikonfirmasi"
  | "disiapkan"
  | "selesai"
  | "dibatalkan";

export type OrderItem = {
  productId: string;
  name:      string;
  price:     number;
  qty:       number;
};

export type CustomerSession = {
  name:    string;
  phone:   string;
  ownerId: string;
};

export type Order = {
  id:                   string;
  ownerId:              string;
  customerName:         string;
  customerPhone:        string;
  alamat:               string;
  catatan?:             string;
  items:                OrderItem[];
  subtotal:             number;
  biayaLayanan:         number;
  total:                number;
  status:               OrderStatus;
  metodeBayarCustomer?: string;
  kurirName?:           string;
  createdAt:            string;
  updatedAt:            string;
};

type OrderContextType = {
  orders: Order[];
  addOrder: (
    order: Omit<Order, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  updateStatus: (
    orderId:    string,
    status:     OrderStatus,
    kurirName?: string
  ) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status:  OrderStatus
  ) => Promise<void>;
  assignKurir: (orderId: string, kurirName: string) => Promise<void>;
};

// Context
const OrderContext = createContext<OrderContextType | null>(null);

// Provider
export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_ORDERS).then((raw) => {
      if (raw) {
        try {
          setOrders(JSON.parse(raw));
        } catch {
          // ignore corrupt data
        }
      }
    });
  }, []);

  function saveOrders(updated: Order[]) {
    AsyncStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated)).catch(
      () => {}
    );
  }

  const addOrder = useCallback(
    async (order: Omit<Order, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newOrder: Order = {
        ...order,
        id:        Date.now().toString(),
        createdAt: now,
        updatedAt: now,
      };
      setOrders((prev) => {
        const updated = [newOrder, ...prev];
        saveOrders(updated);
        return updated;
      });
    },
    []
  );

  const updateStatus = useCallback(
    async (orderId: string, status: OrderStatus, kurirName?: string) => {
      setOrders((prev) => {
        const updated = prev.map((o) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            status,
            updatedAt: new Date().toISOString(),
            kurirName: kurirName !== undefined ? kurirName : o.kurirName,
          };
        });
        saveOrders(updated);
        return updated;
      });
    },
    []
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      await updateStatus(orderId, status);
    },
    [updateStatus]
  );

  const assignKurir = useCallback(
    async (orderId: string, kurirName: string) => {
      setOrders((prev) => {
        const updated = prev.map((o) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            kurirName,
            updatedAt: new Date().toISOString(),
          };
        });
        saveOrders(updated);
        return updated;
      });
    },
    []
  );

  const contextValue: OrderContextType = {
    orders,
    addOrder,
    updateStatus,
    updateOrderStatus,
    assignKurir,
  };

  return (
    <OrderContext.Provider value={contextValue}>
      {children}
    </OrderContext.Provider>
  );
}

// Hook
export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders harus di dalam OrderProvider");
  return ctx;
}