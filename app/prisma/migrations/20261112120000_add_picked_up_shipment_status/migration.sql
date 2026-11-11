-- Pickup confirmation (C5): a driver confirms the goods were collected from
-- the seller before the drop-off. Additive enum value only - no table or
-- column changes, no data rewrite.
ALTER TYPE "ShipmentStatus" ADD VALUE 'picked_up' AFTER 'dispatched';
