export interface DeployConfig {
  region: string;
  help: boolean;
}

const RECOGNIZED_FLAGS = ['--region', '--help'];

/**
 * Parses a string array of CLI arguments into a DeployConfig.
 * Throws on unrecognized flags or missing values.
 */
export function parseArgs(args: string[]): DeployConfig {
  const config: DeployConfig = {
    region: 'us-east-1',
    help: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help') {
      config.help = true;
      i++;
    } else if (arg === '--region') {
      if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
        throw new Error(`Flag --region requires a value`);
      }
      config.region = args[i + 1];
      i += 2;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unrecognized flag: ${arg}`);
    } else {
      i++;
    }
  }

  return config;
}

/**
 * Serializes a DeployConfig to a key=value string representation.
 */
export function serializeConfig(config: DeployConfig): string {
  return `region=${config.region}\nhelp=${config.help}`;
}

/**
 * Deserializes a key=value string back into a DeployConfig.
 */
export function deserializeConfig(str: string): DeployConfig {
  const map = new Map<string, string>();
  for (const line of str.split('\n')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      map.set(line.slice(0, idx), line.slice(idx + 1));
    }
  }

  return {
    region: map.get('region') ?? 'us-east-1',
    help: map.get('help') === 'true',
  };
}
