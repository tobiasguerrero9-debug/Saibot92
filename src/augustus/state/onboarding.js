export function nextOnboardingStep(status) {
  if (!status?.risk) return 2;
  if (!status.account?.agentAuthorized) return 3;
  return 4;
}
