import type { Machine, MachineInput, MachineStatus } from "@/types";
import { apiClient, apiWrite, withFallback, writeOrMock } from "./apiClient";
import { endpoints } from "./endpoints";
import { mockMachineStore } from "@/mocks/machineStore";
import { validateImageFile } from "@/utils/machineImageValidation";

export const machineService = {
  list(): Promise<Machine[]> {
    return withFallback(
      async () => (await apiClient.get<Machine[]>(endpoints.machines)).data,
      () => mockMachineStore.list(),
    );
  },

  getById(id: string): Promise<Machine | undefined> {
    return withFallback(
      async () => (await apiClient.get<Machine>(endpoints.machine(id))).data,
      () => mockMachineStore.getById(id),
    );
  },

  create(input: MachineInput): Promise<Machine> {
    return writeOrMock(
      async () => (await apiClient.post<Machine>(endpoints.machines, input)).data,
      () => mockMachineStore.create(input),
    );
  },

  update(id: string, input: Partial<MachineInput>): Promise<Machine> {
    return writeOrMock(
      async () => (await apiClient.put<Machine>(endpoints.machine(id), input)).data,
      () => mockMachineStore.update(id, input),
    );
  },

  delete(id: string): Promise<void> {
    return writeOrMock(
      async () => {
        await apiClient.delete(endpoints.machine(id));
      },
      () => {
        mockMachineStore.delete(id);
      },
    );
  },

  uploadImage(machineId: string, file: File): Promise<Machine> {
    const validationError = validateImageFile(file);
    if (validationError) throw new Error(validationError);
    return apiWrite(async () => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post<Machine>(endpoints.machineImage(machineId), form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    });
  },

  deleteImage(machineId: string): Promise<Machine> {
    return apiWrite(async () => {
      const { data } = await apiClient.delete<Machine>(endpoints.machineImage(machineId));
      return data;
    });
  },

  updateStatus(machineId: string, status: MachineStatus): Promise<Machine> {
    return writeOrMock(
      async () => {
        const { data } = await apiClient.patch<Machine>(endpoints.machine(machineId), { status });
        return data;
      },
      () => mockMachineStore.update(machineId, { status }),
    );
  },
};
