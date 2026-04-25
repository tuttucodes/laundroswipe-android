import { create } from 'zustand';

export type ScheduleState = {
  step: 1 | 2 | 3 | 4;
  serviceId: string | null;
  serviceName: string | null;
  vendorSlug: string | null;
  vendorName: string | null;
  pickupDate: string | null;
  timeSlotId: string | null;
  timeSlotLabel: string | null;
  instructions: string;
  setStep(step: 1 | 2 | 3 | 4): void;
  setService(id: string, name: string): void;
  setVendor(slug: string, name: string): void;
  setDateSlot(date: string, slotId: string, slotLabel: string): void;
  setInstructions(v: string): void;
  reset(): void;
};

const initial = {
  step: 1 as const,
  serviceId: null,
  serviceName: null,
  vendorSlug: null,
  vendorName: null,
  pickupDate: null,
  timeSlotId: null,
  timeSlotLabel: null,
  instructions: '',
};

export const useSchedule = create<ScheduleState>((set) => ({
  ...initial,
  setStep: (step) => set({ step }),
  setService: (serviceId, serviceName) => set({ serviceId, serviceName }),
  setVendor: (vendorSlug, vendorName) => set({ vendorSlug, vendorName }),
  setDateSlot: (pickupDate, timeSlotId, timeSlotLabel) =>
    set({ pickupDate, timeSlotId, timeSlotLabel }),
  setInstructions: (instructions) => set({ instructions }),
  reset: () => set(initial),
}));
