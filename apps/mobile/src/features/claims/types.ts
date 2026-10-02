export type ClaimChoice = {
  value: string;
  label: string;
};

export type ClaimReport = {
  policy: string;
  policies: ClaimChoice[];
  claimType: string;
  claimTypes: ClaimChoice[];
  occurredAt: string;
  address: string;
  gps: string;
};
