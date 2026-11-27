/**
 * clone --config parameters as Git 2.55.0 writes them.
 *
 * builtin/clone.c write_config passes each `key[=value]` to config.c
 * git_config_parse_parameter: the key must be nonempty and pass git_config_parse_key, and
 * write_one_config first hands it to git_clone_config. That callback needs a value for
 * clone.defaultRemoteName and parses clone.rejectShallow and clone.filterSubmodules with
 * git_config_bool. Without --origin the last clone.defaultRemoteName becomes the remote name,
 * which must pass valid_remote_name.
 */
import { gitBoolean } from './git-boolean.js';
import { validRemoteName } from './push-refspecs.js';

export type ConfigParameterParser = 'clone-config-parameters' | 'clone-config-remote-name';

const KEY_CHARACTER = /^[A-Za-z0-9-]$/;
const ALPHA = /^[A-Za-z]$/;

/** The canonical name of a valid config key (config.c do_parse_config_key), or undefined. */
export function canonicalConfigKey(key: string): string | undefined {
  const lastDot = key.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === key.length - 1) {
    return undefined;
  }
  const firstDot = key.indexOf('.');
  let canonical = '';
  for (const [index, character] of key.split('').entries()) {
    if (index < firstDot || index > lastDot) {
      if (!KEY_CHARACTER.test(character) || (index === lastDot + 1 && !ALPHA.test(character))) {
        return undefined;
      }
      canonical += character.toLowerCase();
    } else if (character === '\n') {
      return undefined;
    } else {
      canonical += character;
    }
  }
  return canonical;
}

/** Split one parameter at its first '='; a parameter without one has no value. */
function splitParameter(parameter: string): [string, string | undefined] {
  const equals = parameter.indexOf('=');
  return equals < 0
    ? [parameter, undefined]
    : [parameter.slice(0, equals), parameter.slice(equals + 1)];
}

const asList = (value: unknown): unknown[] | undefined =>
  typeof value === 'string' ? [value] : Array.isArray(value) ? value : undefined;

/** Whether every parameter has a valid key and a value git_clone_config accepts. */
export function validCloneConfigParameters(value: unknown): boolean {
  const parameters = asList(value);
  return (
    parameters?.every((parameter) => {
      if (typeof parameter !== 'string') {
        return false;
      }
      const [key, text] = splitParameter(parameter);
      const canonical = key === '' ? undefined : canonicalConfigKey(key);
      if (canonical === undefined) {
        return false;
      }
      if (canonical === 'clone.defaultremotename') {
        return text !== undefined;
      }
      if (canonical === 'clone.rejectshallow' || canonical === 'clone.filtersubmodules') {
        return text === undefined || gitBoolean(text) !== undefined;
      }
      return true;
    }) ?? false
  );
}

/** Whether the last clone.defaultRemoteName parameter, if any, names a valid remote. */
export function validCloneConfigRemoteName(value: unknown): boolean {
  const parameters = asList(value);
  if (parameters === undefined) {
    return false;
  }
  let name: string | undefined;
  for (const parameter of parameters) {
    if (typeof parameter === 'string') {
      const [key, text] = splitParameter(parameter);
      if (canonicalConfigKey(key) === 'clone.defaultremotename' && text !== undefined) {
        name = text;
      }
    }
  }
  return name === undefined || validRemoteName(name);
}

/** Runtime check for one of the config parameter parsers. */
export function parseConfigParameters(parser: ConfigParameterParser, value: unknown): boolean {
  return parser === 'clone-config-parameters'
    ? validCloneConfigParameters(value)
    : validCloneConfigRemoteName(value);
}

/** Whether a scalar parser name selects one of the config parameter parsers. */
export function isConfigParameterParser(parser: unknown): parser is ConfigParameterParser {
  return parser === 'clone-config-parameters' || parser === 'clone-config-remote-name';
}
