// Customer-form validation rules ported verbatim from buildgrid-shop.html's
// checkout validators (`placeOrder`, buildgrid-shop.html:553-575): same field
// sets, same error message strings, same regexes. Pure functions — the UI and
// the Stage-2 server boundary (where the same checks must be repeated for
// real, per AGENTS "validate every input on the backend") both call these.

export type FieldErrors = Record<string, string>;

export interface AddressDraft {
  name: string;
  phone: string;
  pin: string;
  city: string;
  line: string;
}

interface FieldSpec {
  key: keyof AddressDraft;
  bad: (v: string) => boolean;
  msg: string;
}

const ADDRESS_RULES: FieldSpec[] = [
  { key: "name", bad: (v) => v.length < 2, msg: "Enter the recipient’s name" },
  { key: "phone", bad: (v) => !/^[6-9]\d{9}$/.test(v), msg: "Enter a valid 10-digit mobile number" },
  { key: "pin", bad: (v) => !/^\d{6}$/.test(v), msg: "Enter a 6-digit pincode" },
  { key: "city", bad: (v) => v.length < 2, msg: "Enter your town or city" },
  { key: "line", bad: (v) => v.length < 5, msg: "Enter the site or house address" },
];

/** Validates a checkout address; returns field-name → message map (empty = valid). */
export function validateAddress(draft: Partial<AddressDraft>): FieldErrors {
  const errors: FieldErrors = {};
  for (const rule of ADDRESS_RULES) {
    const value = (draft[rule.key] ?? "").trim();
    if (rule.bad(value)) errors[rule.key] = rule.msg;
  }
  return errors;
}

export const COD_CAP = 50_000; // D4

/** COD-only platform (D3/D4): returns the block reason for a total, or undefined when COD is allowed. */
export function validateCod(total: number): string | undefined {
  if (total > COD_CAP) return `Cash on delivery is not available above ₹50,000`;
  return undefined;
}
