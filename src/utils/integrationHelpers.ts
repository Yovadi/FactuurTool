export type EBoekhoudenGate = {
  eboekhouden_enabled?: boolean | null;
  eboekhouden_connected?: boolean | null;
  eboekhouden_api_token?: string | null;
};

export function isEBoekhoudenActive(settings: EBoekhoudenGate | null | undefined): boolean {
  return Boolean(
    settings?.eboekhouden_enabled &&
    settings?.eboekhouden_connected &&
    settings?.eboekhouden_api_token
  );
}

export type RemoteRecordCheck = {
  success: boolean;
  status?: number;
  error?: string;
  data?: unknown;
};

export function isRemoteRecordMissing(check: RemoteRecordCheck): boolean {
  if (check.success) return false;
  if (check.status === 404) return true;

  const dataText =
    typeof check.data === 'string'
      ? check.data
      : check.data
        ? JSON.stringify(check.data)
        : '';
  const haystack = `${check.error || ''} ${dataText}`.toLowerCase();

  return (
    haystack.includes('not found') ||
    haystack.includes('niet gevonden') ||
    haystack.includes('does not exist') ||
    /\b404\b/.test(haystack)
  );
}

export type FunctionJsonResult = {
  success: boolean;
  error?: string;
  status?: number;
  [key: string]: unknown;
};

export async function parseFunctionJson(response: Response): Promise<FunctionJsonResult> {
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return {
      success: false,
      error: response.ok
        ? 'Ongeldig antwoord van de server'
        : `Serverfout (${response.status})`,
      status: response.status,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      success: false,
      error: 'Ongeldig antwoord van de server',
      status: response.status,
    };
  }

  const obj = parsed as Record<string, unknown>;
  const success = obj.success === true;
  const error = typeof obj.error === 'string' ? obj.error : undefined;
  const status = typeof obj.status === 'number' ? obj.status : response.status;

  if (!success) {
    return {
      ...obj,
      success: false,
      error: error || (response.ok ? 'Verzoek mislukt' : `Serverfout (${response.status})`),
      status,
    };
  }

  return { ...obj, success: true, error, status };
}
