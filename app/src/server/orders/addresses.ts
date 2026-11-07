import type { PrismaClient } from "@prisma/client";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import type { AddressDto } from "@/lib/api/orderDto";
import type { CreateAddressInput, UpdateAddressInput } from "./validation";

export type AddressDb = Pick<PrismaClient, "address">;

export function toAddress(address: {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pin: string;
  isDefault: boolean;
}): AddressDto {
  return {
    id: address.id,
    label: address.label,
    name: address.name,
    phone: address.phone,
    line1: address.line1,
    city: address.city,
    state: address.state,
    pin: address.pin,
    isDefault: address.isDefault,
  };
}

export async function listAddresses(userId: string, client: AddressDb = db): Promise<AddressDto[]> {
  const rows = await client.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }],
  });
  return rows.map(toAddress);
}

export async function getAddress(
  userId: string,
  addressId: string,
  client: AddressDb = db,
) {
  const address = await client.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new ApiError(404, "address_not_found", "Address not found");
  return address;
}

export async function createAddress(
  userId: string,
  input: CreateAddressInput,
): Promise<AddressDto> {
  return db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    const makeDefault = input.isDefault || count === 0;
    if (makeDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const address = await tx.address.create({
      data: {
        userId,
        label: input.label,
        name: input.name,
        phone: input.phone,
        line1: input.line1,
        city: input.city,
        state: input.state,
        pin: input.pin,
        isDefault: makeDefault,
      },
    });
    return toAddress(address);
  });
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: UpdateAddressInput,
): Promise<AddressDto> {
  return db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) throw new ApiError(404, "address_not_found", "Address not found");

    if (input.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const address = await tx.address.update({
      where: { id: existing.id },
      data: input,
    });
    return toAddress(address);
  });
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) throw new ApiError(404, "address_not_found", "Address not found");
    await tx.address.delete({ where: { id: existing.id } });
    if (existing.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { id: "asc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}
