import { useMutation, useQuery, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  createVendor,
  getVendorByUser,
  VendorProfile,
} from "@/backend/marketplaceApi";

export type UseVendorResult = {
  vendor: VendorProfile | null | undefined;
  isVendorLoading: boolean;
  createVendor: UseMutationResult<string, unknown, {
    type: VendorProfile["type"];
    shopName: string;
    logoUrl?: string | null;
    campusId?: string | null;
  }>;
};

export function useVendor(): UseVendorResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const vendorQuery = useQuery<VendorProfile | null>({
    queryKey: ["vendor", user?.id ?? ""],
    queryFn: () => getVendorByUser(user?.id ?? ""),
    enabled: !!user?.id,
  });

  const createVendorMutation = useMutation({
    mutationFn: (input: {
      type: VendorProfile["type"];
      shopName: string;
      logoUrl?: string | null;
      campusId?: string | null;
    }) => createVendor(user!.id, input.type, input.shopName, input.logoUrl, input.campusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", user?.id ?? ""] });
    },
  });

  return { vendor: vendorQuery.data, isVendorLoading: vendorQuery.isLoading, createVendor: createVendorMutation };
}
