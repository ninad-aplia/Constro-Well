-- WP-2 refunds: approved customer refunds also create a proportional commission
-- credit. Additive enum value only; no table/column change.
ALTER TYPE "SellerAdjustmentType" ADD VALUE 'commission_credit';
