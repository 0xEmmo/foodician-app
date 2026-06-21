"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus, Trash2, Star } from "lucide-react";
import {
  fetchUserAddresses, addAddress, deleteAddress, setDefaultAddress,
  type DeliveryAddress,
} from "@/src/lib/addresses";
import { useAppStore } from "@/src/store/useAppStore";

interface AddressManagerProps {
  selectable?:  boolean;
  onSelect?:    (addr: DeliveryAddress) => void;
  selectedId?:  string | null;
}

const BLANK = { address_name: "Home", street: "", city: "Lagos", state: "Lagos", phone: "", is_default: false };

export default function AddressManager({ selectable, onSelect, selectedId }: AddressManagerProps) {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState(BLANK);

  async function load() {
    if (!sessionUser) return;
    const data = await fetchUserAddresses(sessionUser.id);
    setAddresses(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [sessionUser]);

  async function handleAdd() {
    if (!sessionUser || !form.street.trim()) return;
    setSaving(true);
    await addAddress(sessionUser.id, form);
    setForm(BLANK);
    setShowForm(false);
    await load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await deleteAddress(id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSetDefault(id: string) {
    if (!sessionUser) return;
    await setDefaultAddress(sessionUser.id, id);
    await load();
  }

  if (loading) return <div className="h-16 shimmer rounded-xl" />;

  return (
    <div className="space-y-3">
      {addresses.map((addr) => (
        <div
          key={addr.id}
          onClick={() => selectable && onSelect?.(addr)}
          className={`bg-[#0F0F0F] rounded-xl border p-3 transition-colors ${
            selectable ? "cursor-pointer hover:border-[#E8192C]/40" : ""
          } ${selectedId === addr.id ? "border-[#E8192C]/60" : "border-[#262626]"}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <MapPin size={14} className="text-[#E8192C] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#F5F5F5] truncate">{addr.address_name}</p>
                  {addr.is_default && (
                    <span className="text-[10px] bg-[#E8192C]/10 text-[#E8192C] border border-[#E8192C]/20 px-1.5 py-0.5 rounded-full">Default</span>
                  )}
                </div>
                <p className="text-xs text-[#A0A0A0] truncate">{addr.street}, {addr.city}, {addr.state}</p>
                {addr.phone && <p className="text-xs text-[#A0A0A0]">{addr.phone}</p>}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {!addr.is_default && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSetDefault(addr.id); }}
                  className="p-1.5 text-[#A0A0A0] hover:text-[#F5C300] transition-colors"
                  title="Set as default"
                >
                  <Star size={13} />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(addr.id); }}
                className="p-1.5 text-[#A0A0A0] hover:text-[#E8192C] transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Add form */}
      {showForm ? (
        <div className="bg-[#0F0F0F] border border-[#E8192C]/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-[#F5F5F5]">New Address</p>
          {[
            { key: "address_name", placeholder: "Label (e.g. Home, Office)" },
            { key: "street",       placeholder: "Street address *" },
            { key: "city",         placeholder: "City" },
            { key: "state",        placeholder: "State" },
            { key: "phone",        placeholder: "Phone (optional)" },
          ].map(({ key, placeholder }) => (
            <input
              key={key}
              value={form[key as keyof typeof form] as string}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full bg-[#161616] border border-[#262626] rounded-lg px-3 py-2.5 text-sm text-[#F5F5F5] placeholder-[#A0A0A0] outline-none focus:border-[#E8192C]/50 transition-colors"
            />
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
              className="accent-[#E8192C]"
            />
            <span className="text-xs text-[#A0A0A0]">Set as default</span>
          </label>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-[#262626] text-sm text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={!form.street.trim() || saving}
              className="flex-1 py-2.5 rounded-xl bg-[#E8192C] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#FF2E43] transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-2 justify-center py-3 rounded-xl border border-dashed border-[#262626] text-sm text-[#A0A0A0] hover:border-[#E8192C]/40 hover:text-[#F5F5F5] transition-colors"
        >
          <Plus size={16} />
          Add address
        </button>
      )}
    </div>
  );
}
