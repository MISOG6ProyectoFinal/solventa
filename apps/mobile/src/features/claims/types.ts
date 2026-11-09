export type ClaimChoice = {
  value: string;
  label: string;
};

export type ClaimReport = {
  claimType: string;
  claimTypes: ClaimChoice[];
  occurredAt: string;
};
