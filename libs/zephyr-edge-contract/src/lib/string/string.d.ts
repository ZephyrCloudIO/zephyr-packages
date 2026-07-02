/**
 * Replaces all occurrences of {{key}} in the string with the value of the key in the
 * params object.
 *
 * `{{ example }}` or `{{ example = value }}` to have a default value
 */
export declare function formatString<const S extends string>(
  str: S,
  params: Record<FindTemplates<S>, string | number | boolean>
): string;
/**
 * Gets a string like `{{ key }} text {{ key2 }}` and returns an string union with key and
 * key2
 */
export type FindTemplates<S extends string> =
  `${S}` extends `${infer Prefix}{{ ${infer Key} }}${infer Suffix}`
    ? FindTemplates<Prefix> | Key | FindTemplates<Suffix>
    : never;
