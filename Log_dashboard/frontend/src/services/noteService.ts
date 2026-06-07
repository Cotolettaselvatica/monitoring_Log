import type { MachineNote, NoteType } from "@/types";
import { apiClient, apiWrite, withFallback } from "./apiClient";
import { endpoints } from "./endpoints";
import { mockNotes } from "@/mocks/data";

export interface NewNoteInput {
  machineId: string;
  type: NoteType;
  author: string;
  text: string;
}

export const noteService = {
  listByMachine(machineId: string): Promise<MachineNote[]> {
    return withFallback(
      async () =>
        (await apiClient.get<MachineNote[]>(endpoints.machineNotes(machineId))).data,
      () => mockNotes.filter((n) => n.machineId === machineId),
    );
  },

  create(input: NewNoteInput): Promise<MachineNote> {
    return apiWrite(async () =>
      (await apiClient.post<MachineNote>(endpoints.machineNotes(input.machineId), input)).data,
    );
  },
};
