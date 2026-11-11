import { apiFetch } from "./client";
import type { DriverJobDto, DriverJobsResponse } from "./driverDto";

export async function fetchDriverJob(shipmentId: string): Promise<DriverJobDto> {
  const response = await apiFetch<{ job: DriverJobDto }>(
    `/api/driver/jobs/${encodeURIComponent(shipmentId)}`,
  );
  return response.job;
}

export async function acceptDriverJob(shipmentId: string): Promise<DriverJobDto> {
  const response = await apiFetch<{ job: DriverJobDto }>(
    `/api/driver/jobs/${encodeURIComponent(shipmentId)}/accept`,
    { method: "POST" },
  );
  return response.job;
}

export async function confirmDriverPickup(shipmentId: string): Promise<DriverJobDto> {
  const response = await apiFetch<{ job: DriverJobDto }>(
    `/api/driver/jobs/${encodeURIComponent(shipmentId)}/pickup`,
    { method: "POST" },
  );
  return response.job;
}

export async function declineDriverJob(shipmentId: string, reason: string): Promise<DriverJobDto> {
  const response = await apiFetch<{ job: DriverJobDto }>(
    `/api/driver/jobs/${encodeURIComponent(shipmentId)}/decline`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
  return response.job;
}

export async function deliverDriverJob(
  shipmentId: string,
  input: { otp: string; deliveredQty: number },
): Promise<DriverJobDto> {
  const response = await apiFetch<{ job: DriverJobDto }>(
    `/api/driver/jobs/${encodeURIComponent(shipmentId)}/deliver`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.job;
}

export type DriverIssueType = "failed_attempt" | "damaged_goods" | "short_quantity";

export async function reportDriverJobIssue(
  shipmentId: string,
  input: { type: DriverIssueType; note: string; deliveredQty?: number },
): Promise<DriverJobDto> {
  const response = await apiFetch<{ job: DriverJobDto }>(
    `/api/driver/jobs/${encodeURIComponent(shipmentId)}/issue`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.job;
}

export type { DriverJobsResponse };
