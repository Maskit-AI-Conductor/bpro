/**
 * bpro model — Model registry management.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { requireBproDir, loadModels, saveModelsRaw, type ModelEntry } from '../core/project.js';
import { parseModelName, createAdapter } from '../models/registry.js';
import { printSuccess, printError, printInfo, createSpinner } from '../utils/display.js';

export const modelCommand = new Command('model')
  .description('Manage model registry');

modelCommand
  .command('add <name>')
  .description('Register a model (e.g. ollama:qwen2.5:7b, claude-opus, gpt-4o, gemini-pro)')
  .option('--endpoint <url>', 'API endpoint (for Ollama or custom)')
  .option('--api-key <key>', 'API key')
  .option('--env-var <var>', 'Environment variable name for API key')
  .action(async (name: string, opts: { endpoint?: string; apiKey?: string; envVar?: string }) => {
    try {
      const bproDir = requireBproDir();
      const registry = loadModels(bproDir);

      // Check for duplicate
      if (registry.models.find((m) => m.name === name)) {
        printError(`Model '${name}' already registered. Remove it first with: bpro model remove ${name}`);
        process.exit(1);
      }

      const parsed = parseModelName(name);

      const entry: ModelEntry = {
        name,
        provider: parsed.provider,
        model: parsed.model,
        added_at: new Date().toISOString(),
      };

      if (opts.endpoint) entry.endpoint = opts.endpoint;
      if (opts.apiKey) entry.api_key = opts.apiKey;
      if (opts.envVar) entry.env_var = opts.envVar;

      // For ollama, set default endpoint
      if (parsed.provider === 'ollama' && !entry.endpoint) {
        entry.endpoint = 'http://localhost:11434';
      }

      // Health check
      const spinner = createSpinner(`Checking ${name}...`);
      spinner.start();

      try {
        const adapter = createAdapter(entry);
        const healthy = await adapter.checkHealth();
        if (healthy) {
          spinner.succeed(`${name} is reachable`);
        } else {
          spinner.warn(`${name} registered but health check failed — model may not be available`);
        }
      } catch {
        spinner.warn(`${name} registered but health check failed`);
      }

      registry.models.push(entry);
      saveModelsRaw(bproDir, registry);

      printSuccess(`Model '${name}' registered (${parsed.provider})`);

      // Hint if no conductor
      const { loadConfig } = await import('../core/project.js');
      const config = loadConfig(bproDir);
      if (!config.conductor) {
        console.log();
        console.log(`  ${chalk.dim('Set as conductor:')} ${chalk.cyan(`bpro config set conductor ${name}`)}`);
      }
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

modelCommand
  .command('list')
  .description('List registered models')
  .action(async () => {
    try {
      const bproDir = requireBproDir();
      const registry = loadModels(bproDir);
      const { loadConfig } = await import('../core/project.js');
      const config = loadConfig(bproDir);

      if (registry.models.length === 0) {
        printInfo('No models registered.');
        console.log(`  ${chalk.cyan('bpro model add ollama:qwen2.5:7b')} — register your first model`);
        return;
      }

      console.log();
      console.log(`  ${chalk.bold('Registered Models')}`);
      console.log(`  ${chalk.dim('-'.repeat(60))}`);

      for (const m of registry.models) {
        const isConductor = m.name === config.conductor;
        const badge = isConductor ? chalk.yellow(' [conductor]') : '';
        const endpoint = m.endpoint ? chalk.dim(` (${m.endpoint})`) : '';
        const apiKeyHint = m.api_key ? chalk.dim(' [key set]') : '';
        const envHint = m.env_var ? chalk.dim(` [env: ${m.env_var}]`) : '';

        console.log(`  ${chalk.cyan(m.name.padEnd(25))}${chalk.dim(m.provider.padEnd(12))}${m.model}${endpoint}${apiKeyHint}${envHint}${badge}`);
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

modelCommand
  .command('remove <name>')
  .description('Remove a model from registry')
  .action(async (name: string) => {
    try {
      const bproDir = requireBproDir();
      const registry = loadModels(bproDir);

      const idx = registry.models.findIndex((m) => m.name === name);
      if (idx === -1) {
        printError(`Model '${name}' not found.`);
        process.exit(1);
      }

      registry.models.splice(idx, 1);
      saveModelsRaw(bproDir, registry);

      printSuccess(`Model '${name}' removed.`);

      // Warn if it was the conductor
      const { loadConfig } = await import('../core/project.js');
      const config = loadConfig(bproDir);
      if (config.conductor === name) {
        console.log(`  ${chalk.yellow('WARN')} This was the conductor. Set a new one: ${chalk.cyan('bpro config set conductor <model>')}`);
      }
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
