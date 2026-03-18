import * as yaml from 'js-yaml';

/**
 * Serializes a Helm values object to a YAML string.
 * @param obj - The values object to serialize
 * @returns A YAML string representation of the object
 */
export function serializeValues(obj: Record<string, unknown>): string {
  return yaml.dump(obj);
}

/**
 * Deserializes a YAML string back into a Helm values object.
 * @param yamlStr - The YAML string to parse
 * @returns The parsed values object
 * @throws Error if the YAML string is invalid
 */
export function deserializeValues(yamlStr: string): Record<string, unknown> {
  const result = yaml.load(yamlStr);
  if (result === null || result === undefined || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('YAML input must represent a mapping (object) at the top level');
  }
  return result as Record<string, unknown>;
}
