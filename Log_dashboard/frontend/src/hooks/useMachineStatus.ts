import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MachineStatus } from "@/types";
import { machineService } from "@/services/machineService";

export function useUpdateMachineStatus(machineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: MachineStatus) => machineService.updateStatus(machineId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      qc.invalidateQueries({ queryKey: ["machine", machineId] });
    },
  });
}
