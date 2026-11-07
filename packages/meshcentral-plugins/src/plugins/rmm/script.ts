type Parameter = {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'enum';
  options?: string[];
};
export type Script = { name: string; description: string; body: string; parameters: Parameter[] };

export class RmmError extends Error {}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RmmError('INVALID_INPUT');
  return value as Record<string, unknown>;
}

export function parseScript(input: unknown): Script {
  const { name, description, body, parameters } = object(input);
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 100 ||
    typeof description !== 'string' ||
    description.length > 1000 ||
    typeof body !== 'string' ||
    !body.trim() ||
    Buffer.byteLength(body) > 65536 ||
    !Array.isArray(parameters) ||
    parameters.length > 20
  )
    throw new RmmError('INVALID_SCRIPT');
  const names = new Set<string>();
  const definitions = parameters.map((input: unknown): Parameter => {
    const { name, type, options } = object(input);
    if (
      typeof name !== 'string' ||
      !/^[a-z][a-z0-9_]{0,39}$/i.test(name) ||
      names.has(name.toLowerCase()) ||
      (type !== 'string' && type !== 'integer' && type !== 'boolean' && type !== 'enum')
    ) {
      throw new RmmError('INVALID_PARAMETER');
    }
    names.add(name.toLowerCase());
    if (type !== 'enum') return { name, type };
    if (
      !Array.isArray(options) ||
      !options.length ||
      options.length > 30 ||
      options.some((item: unknown) => typeof item !== 'string' || !item || item.length > 100) ||
      new Set(options).size !== options.length
    )
      throw new RmmError('INVALID_PARAMETER');
    return { name, type, options };
  });
  return {
    name: name.trim(),
    description,
    body: body.replace(/^\uFEFF/, ''),
    parameters: definitions,
  };
}

export function parseValues(script: Script, input: unknown) {
  const values = object(input);
  if (Object.keys(values).length !== script.parameters.length)
    throw new RmmError('INVALID_PARAMETER');
  return Object.fromEntries(
    script.parameters.map(({ name, type, options }) => {
      const value = Object.hasOwn(values, name) ? values[name] : undefined;
      if (
        (type === 'string' && typeof value === 'string' && value.length <= 1024) ||
        (type === 'integer' &&
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= -2147483648 &&
          value <= 2147483647) ||
        (type === 'boolean' && typeof value === 'boolean') ||
        (type === 'enum' && typeof value === 'string' && options?.includes(value))
      )
        return [name, value];
      throw new RmmError('INVALID_PARAMETER');
    }),
  );
}

export const examples: Record<string, Script> = {
  'service-status': {
    name: 'Service status',
    description: 'Check a Windows service by name.',
    body: 'param([string]$ServiceName)\nGet-Service -Name $ServiceName | Format-Table Name, Status',
    parameters: [{ name: 'ServiceName', type: 'string' }],
  },
  'system-diagnostics': {
    name: 'System diagnostics',
    description: 'Read Windows version and boot time.',
    body: 'Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, LastBootUpTime',
    parameters: [],
  },
};
